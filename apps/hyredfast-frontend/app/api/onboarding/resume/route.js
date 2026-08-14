import { NextResponse } from "next/server";
import mammoth from "mammoth";
import { tryAuth } from "@/lib/auth";
import { openai } from "@/lib/openai";
import { RESUME_MAX_BYTES } from "@/lib/constants/onboarding";

// pdfjs (via unpdf) needs the Node runtime, not Edge.
export const runtime = "nodejs";

const SYSTEM_PROMPT = `You extract structured facts from a résumé. Return JSON only, no markdown fences.

Shape:
{
  "name": "Full name, or null",
  "headline": "Current or most recent job title, or null",
  "yearsOfExperience": 0,
  "skills": ["at most 15, most prominent first"],
  "companies": ["most recent employers, most recent first, at most 6"],
  "education": [{ "institution": "", "degree": "", "year": "" }],
  "links": { "linkedin": null, "github": null, "portfolio": null },
  "summary": "Two sentences describing this candidate in the third person"
}

Rules:
- Use null for anything the résumé does not state. Never invent a value.
- yearsOfExperience is a whole number inferred from work history. Use 0 for students with no full-time roles.
- Internships count towards companies but not towards yearsOfExperience.
- Write the summary with they/them. A name is not a statement of gender, and this
  text goes on to shape emails sent in the candidate's own voice.`;

/** Longer résumés are truncated; the top of a résumé carries the useful part. */
const MAX_CHARS = 20000;

async function extractText(file) {
  const buffer = Buffer.from(await file.arrayBuffer());
  const name = (file.name || "").toLowerCase();

  if (name.endsWith(".pdf")) {
    // Imported lazily so the pdfjs bundle is only pulled in when a PDF actually
    // arrives, rather than on every cold start of this route.
    const { extractText: extractPdfText, getDocumentProxy } = await import(
      "unpdf"
    );
    const pdf = await getDocumentProxy(new Uint8Array(buffer));
    const { text } = await extractPdfText(pdf, { mergePages: true });
    return text;
  }

  if (name.endsWith(".docx")) {
    const { value } = await mammoth.extractRawText({ buffer });
    return value;
  }

  if (name.endsWith(".txt")) {
    return buffer.toString("utf8");
  }

  return null;
}

/**
 * Parses an uploaded résumé and returns the extracted fields.
 *
 * The file itself is never written anywhere — it lives in this request's memory
 * and is gone when the response is sent. The caller keeps the returned JSON in
 * component state and submits it with the rest of the questionnaire.
 */
export async function POST(request) {
  const { response: authResponse } = tryAuth(request);
  if (authResponse) return authResponse;

  try {
    const form = await request.formData();
    const file = form.get("file");

    if (!file || typeof file.arrayBuffer !== "function") {
      return NextResponse.json({ error: "No file uploaded" }, { status: 400 });
    }

    if (file.size > RESUME_MAX_BYTES) {
      return NextResponse.json(
        { error: "That file is larger than 5MB" },
        { status: 400 },
      );
    }

    const text = await extractText(file);

    if (text === null) {
      return NextResponse.json(
        { error: "Upload a PDF, DOCX, or TXT file" },
        { status: 400 },
      );
    }

    // A PDF of scanned images extracts to almost nothing, and sending that to
    // the model just burns a call to produce all-nulls.
    if (text.trim().length < 100) {
      return NextResponse.json(
        {
          error:
            "We couldn't read any text from that file. If it's a scan, try a text-based PDF.",
        },
        { status: 422 },
      );
    }

    const completion = await openai.chat.completions.create({
      model: "gpt-4o-mini",
      messages: [
        { role: "system", content: SYSTEM_PROMPT },
        { role: "user", content: text.slice(0, MAX_CHARS) },
      ],
      response_format: { type: "json_object" },
      temperature: 0.1,
    });

    const parsed = JSON.parse(completion.choices[0].message.content);

    return NextResponse.json({ fileName: file.name, parsed });
  } catch (error) {
    console.error("[API] onboarding/resume error:", error);
    return NextResponse.json(
      { error: "Failed to read that résumé" },
      { status: 500 },
    );
  }
}
