"use client";

import * as React from "react";
// Extension comes via @tiptap/react's re-export of @tiptap/core — @tiptap/core
// isn't a direct dependency, so importing it by name wouldn't resolve.
import {
  EditorContent,
  Extension,
  useEditor,
  useEditorState,
} from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import { Placeholder } from "@tiptap/extensions";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet } from "@tiptap/pm/view";
import {
  BoldIcon,
  ItalicIcon,
  LinkIcon,
  ListIcon,
  ListOrderedIcon,
  RedoIcon,
  RemoveFormattingIcon,
  UndoIcon,
} from "lucide-react";

import { cn } from "@/lib/utils";

/**
 * Enter inserts a line break rather than a new paragraph. A <p> carries ~1em
 * of top/bottom margin, which renders in mail clients as the oversized double
 * gaps that make an email look templated; <br> gives hand-typed spacing.
 * Lists, quotes and code blocks keep the normal behaviour — Enter has to make
 * a new list item there.
 */
const BreakOnEnter = Extension.create({
  name: "breakOnEnter",
  addKeyboardShortcuts() {
    return {
      Enter: () => {
        const { editor } = this;
        if (
          editor.isActive("listItem") ||
          editor.isActive("codeBlock") ||
          editor.isActive("blockquote")
        ) {
          return false;
        }
        return editor.commands.setHardBreak();
      },
    };
  },
});

/**
 * Draws {{name}} as a chip showing just the field name.
 *
 * This is a decoration, not a node: the text in the document stays literally
 * "{{name}}", so getHTML() still returns exactly what the Mustache renderer on
 * the send path expects. A node would have to be serialised back to braces,
 * and any gap there would ship broken templates. The braces are decorated
 * separately and rendered at zero width — hidden, but still really there.
 */
const VARIABLE_PATTERN = /(\{\{\s*)(\w+)(\s*(?:\|[^}]*)?\}\})/g;

const VariableChip = Extension.create({
  name: "variableChip",

  addOptions() {
    return { variables: [] };
  },

  addProseMirrorPlugins() {
    const known = this.options.variables;

    return [
      new Plugin({
        key: new PluginKey("variableChip"),
        props: {
          decorations: ({ doc }) => {
            const decorations = [];

            doc.descendants((node, pos) => {
              if (!node.isText) return;

              for (const match of node.text.matchAll(VARIABLE_PATTERN)) {
                const [, open, name, close] = match;
                const index = known.indexOf(name);
                const label = pos + match.index + open.length;

                decorations.push(
                  Decoration.inline(pos + match.index, label, {
                    class: "email-variable-brace",
                  }),
                  Decoration.inline(label, label + name.length, {
                    class:
                      index === -1
                        ? "email-variable email-variable-unknown"
                        : `email-variable email-variable-${index % 5}`,
                    title:
                      index === -1
                        ? `"${name}" isn't a known variable — it will be removed when the email is sent`
                        : `Replaced with each contact's ${name}`,
                  }),
                  Decoration.inline(
                    label + name.length,
                    label + name.length + close.length,
                    { class: "email-variable-brace" },
                  ),
                );
              }
            });

            return DecorationSet.create(doc, decorations);
          },
        },
      }),
    ];
  },
});

/**
 * Reduce pasted markup to text. Content pasted from Docs, Word or a web page
 * carries inline styles, fonts and wrapper divs — the other tell that an email
 * wasn't typed by a person, and a common source of broken rendering in mail
 * clients. Block boundaries survive as newlines so the shape is kept.
 */
function htmlToPlainText(html) {
  const withBreaks = html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, "")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|li|tr|h[1-6]|blockquote)>/gi, "\n")
    .replace(/<[^>]+>/g, "");

  // Entity decoding needs the DOM; paste only ever happens in the browser.
  const el = document.createElement("textarea");
  el.innerHTML = withBreaks;
  return el.value.replace(/\n{3,}/g, "\n\n").trim();
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function ToolbarButton({ onClick, active, disabled, label, icon: Icon }) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-label={label}
      aria-pressed={active}
      title={label}
      className={cn(
        "inline-flex size-7 items-center justify-center rounded-md transition-colors",
        "focus-visible:ring-[3px] focus-visible:ring-ring/50 focus-visible:outline-none",
        "disabled:pointer-events-none disabled:opacity-40",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:bg-accent hover:text-foreground",
      )}
    >
      <Icon className="size-3.5" />
    </button>
  );
}

function Toolbar({ editor }) {
  const state = useEditorState({
    editor,
    selector: (ctx) => ({
      isBold: ctx.editor.isActive("bold"),
      isItalic: ctx.editor.isActive("italic"),
      isBulletList: ctx.editor.isActive("bulletList"),
      isOrderedList: ctx.editor.isActive("orderedList"),
      isLink: ctx.editor.isActive("link"),
      canUndo: ctx.editor.can().undo(),
      canRedo: ctx.editor.can().redo(),
    }),
  });

  const toggleLink = () => {
    const previous = editor.getAttributes("link").href;
    const href = window.prompt("Link URL", previous || "https://");
    if (href === null) return;
    if (href === "") {
      editor.chain().focus().extendMarkRange("link").unsetLink().run();
      return;
    }
    editor.chain().focus().extendMarkRange("link").setLink({ href }).run();
  };

  return (
    <div className="flex flex-wrap items-center gap-0.5 border-b border-border px-2 py-1.5">
      <ToolbarButton
        icon={BoldIcon}
        label="Bold"
        active={state.isBold}
        onClick={() => editor.chain().focus().toggleBold().run()}
      />
      <ToolbarButton
        icon={ItalicIcon}
        label="Italic"
        active={state.isItalic}
        onClick={() => editor.chain().focus().toggleItalic().run()}
      />
      <ToolbarButton
        icon={ListIcon}
        label="Bullet list"
        active={state.isBulletList}
        onClick={() => editor.chain().focus().toggleBulletList().run()}
      />
      <ToolbarButton
        icon={ListOrderedIcon}
        label="Numbered list"
        active={state.isOrderedList}
        onClick={() => editor.chain().focus().toggleOrderedList().run()}
      />
      <ToolbarButton
        icon={LinkIcon}
        label="Link"
        active={state.isLink}
        onClick={toggleLink}
      />

      <span className="mx-1 h-4 w-px bg-border" />

      <ToolbarButton
        icon={RemoveFormattingIcon}
        label="Clear formatting"
        onClick={() =>
          editor.chain().focus().unsetAllMarks().clearNodes().run()
        }
      />
      <ToolbarButton
        icon={UndoIcon}
        label="Undo"
        disabled={!state.canUndo}
        onClick={() => editor.chain().focus().undo().run()}
      />
      <ToolbarButton
        icon={RedoIcon}
        label="Redo"
        disabled={!state.canRedo}
        onClick={() => editor.chain().focus().redo().run()}
      />
    </div>
  );
}

const RichTextEditor = React.forwardRef(function RichTextEditor(
  {
    content = "",
    onChange,
    onBlur,
    placeholder = "Start typing...",
    variables = [],
    className,
    editorClassName,
  },
  ref,
) {
  const editor = useEditor({
    // Rendering on the server then hydrating throws — ProseMirror owns the DOM
    // it renders into.
    immediatelyRender: false,
    extensions: [
      StarterKit.configure({
        // An email body has no document outline, and a horizontal rule in one
        // reads as a broken image in most clients.
        heading: false,
        horizontalRule: false,
        link: {
          openOnClick: false,
          HTMLAttributes: { rel: "noopener noreferrer" },
        },
      }),
      Placeholder.configure({ placeholder }),
      VariableChip.configure({ variables }),
      BreakOnEnter,
    ],
    content,
    onUpdate: ({ editor }) => onChange?.(editor.getHTML()),
    onBlur: ({ editor }) => onBlur?.(editor.getHTML()),
    editorProps: {
      transformPastedHTML: (html) =>
        escapeHtml(htmlToPlainText(html)).replace(/\n/g, "<br>"),
      attributes: {
        class: cn(
          "min-h-full px-3 py-2 text-sm leading-relaxed focus:outline-none",
          "[&_p]:my-0 [&_a]:text-primary [&_a]:underline",
          "[&_ul]:my-1 [&_ul]:ml-5 [&_ul]:list-disc",
          "[&_ol]:my-1 [&_ol]:ml-5 [&_ol]:list-decimal",
          "[&_blockquote]:my-1 [&_blockquote]:border-l-2 [&_blockquote]:border-border [&_blockquote]:pl-3",
          "[&_code]:rounded [&_code]:bg-accent [&_code]:px-1 [&_code]:py-0.5",
          "[&_.email-variable]:rounded [&_.email-variable]:border [&_.email-variable]:border-primary/25",
          "[&_.email-variable]:bg-primary/10 [&_.email-variable]:px-1 [&_.email-variable]:py-px",
          "[&_.email-variable]:text-[0.9em] [&_.email-variable]:font-medium [&_.email-variable]:text-primary",
          "[&_.email-variable-unknown]:border-destructive/25 [&_.email-variable-unknown]:bg-destructive/10",
          "[&_.email-variable-unknown]:text-destructive",
          "[&_.is-editor-empty:first-child::before]:pointer-events-none",
          "[&_.is-editor-empty:first-child::before]:float-left",
          "[&_.is-editor-empty:first-child::before]:h-0",
          "[&_.is-editor-empty:first-child::before]:text-muted-foreground",
          "[&_.is-editor-empty:first-child::before]:content-[attr(data-placeholder)]",
          editorClassName,
        ),
      },
    },
  });

  React.useImperativeHandle(ref, () => ({ editor }), [editor]);

  // Follow the prop when it changes from outside (loading another template, or
  // the AI rewrite replacing the body) without clobbering what's being typed.
  React.useEffect(() => {
    if (!editor || content === editor.getHTML()) return;
    editor.commands.setContent(content || "", { emitUpdate: false });
  }, [content, editor]);

  return (
    <div
      className={cn(
        "flex min-h-0 flex-col overflow-hidden rounded-lg border border-border bg-background focus-within:border-ring",
        className,
      )}
    >
      {editor && <Toolbar editor={editor} />}
      <EditorContent
        editor={editor}
        className="min-h-0 flex-1 overflow-y-auto"
      />
    </div>
  );
});

export { RichTextEditor };
