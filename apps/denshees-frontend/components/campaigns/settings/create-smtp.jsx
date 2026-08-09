"use client";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { post } from "@/lib/apis";
import { cn } from "@/lib/utils";
import { EmailIcon } from "mage-icons-react/bulk";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { mutate } from "swr";
import useSWRMutation from "swr/mutation";
import { z } from "zod";
import GmailSVG from "@/assets/emails/gmail.svg";
import GodaddySVG from "@/assets/emails/godaddy.svg";
import SESSVG from "@/assets/emails/ses.svg";
import SendGridSVG from "@/assets/emails/sendgrid.svg";
import Image from "next/image";
import Link from "next/link";

const PROVIDERS = [
  {
    name: "Gmail",
    logo: GmailSVG,
    defaults: {
      host: "smtp.gmail.com",
      port: 587,
      imap_host: "imap.gmail.com",
      secure: false,
    },
  },
  {
    name: "SendGrid",
    logo: SendGridSVG,
    defaults: {
      host: "smtp.sendgrid.net",
      port: 587,
      imap_host: "imap.sendgrid.net",
      secure: true,
    },
  },
  {
    name: "SES",
    logo: SESSVG,
    defaults: {
      host: "email-smtp.us-east-1.amazonaws.com",
      port: 587,
      imap_host: "email-imap.us-east-1.amazonaws.com",
      secure: true,
    },
  },
  {
    name: "Godaddy",
    logo: GodaddySVG,
    defaults: {
      host: "smtp.secureserver.net",
      port: 465,
      imap_host: "imap.secureserver.net",
      secure: true,
    },
  },
  {
    name: "Custom",
    logo: null,
    defaults: {
      host: "",
      port: 587,
      imap_host: "",
      secure: false,
    },
  },
];

const credentialSchema = z.object({
  username: z.string().email("Enter a valid email address"),
  password: z.string().min(4, "Password is too short"),
  host: z.string().min(1, "Host is required"),
  // The server always runs an IMAP check before saving, so a blank host fails
  // there with a generic message. Catch it here where we can point at the field.
  imap_host: z.string().min(1, "IMAP host is required"),
  port: z.number().min(1, "Enter a valid port"),
  secure: z.boolean(),
});

// Component for loading spinner
const LoadingSpinner = () => (
  <div role="status">
    <svg
      aria-hidden="true"
      className="inline w-5 h-5 text-muted animate-spin dark:text-foreground fill-gray-600 dark:fill-gray-300"
      viewBox="0 0 100 101"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M100 50.5908C100 78.2051 77.6142 100.591 50 100.591C22.3858 100.591 0 78.2051 0 50.5908C0 22.9766 22.3858 0.59082 50 0.59082C77.6142 0.59082 100 22.9766 100 50.5908ZM9.08144 50.5908C9.08144 73.1895 27.4013 91.5094 50 91.5094C72.5987 91.5094 90.9186 73.1895 90.9186 50.5908C90.9186 27.9921 72.5987 9.67226 50 9.67226C27.4013 9.67226 9.08144 27.9921 9.08144 50.5908Z"
        fill="currentColor"
      />
      <path
        d="M93.9676 39.0409C96.393 38.4038 97.8624 35.9116 97.0079 33.5539C95.2932 28.8227 92.871 24.3692 89.8167 20.348C85.8452 15.1192 80.8826 10.7238 75.2124 7.41289C69.5422 4.10194 63.2754 1.94025 56.7698 1.05124C51.7666 0.367541 46.6976 0.446843 41.7345 1.27873C39.2613 1.69328 37.813 4.19778 38.4501 6.62326C39.0873 9.04874 41.5694 10.4717 44.0505 10.1071C47.8511 9.54855 51.7191 9.52689 55.5402 10.0491C60.8642 10.7766 65.9928 12.5457 70.6331 15.2552C75.2735 17.9648 79.3347 21.5619 82.5849 25.841C84.9175 28.9121 86.7997 32.2913 88.1811 35.8758C89.083 38.2158 91.5421 39.6781 93.9676 39.0409Z"
        fill="currentFill"
      />
    </svg>
    <span className="sr-only">Loading...</span>
  </div>
);

const ProviderChip = ({ provider, isSelected, onSelect }) => (
  <button
    type="button"
    onClick={() => onSelect(provider)}
    aria-pressed={isSelected}
    className={cn(
      "flex items-center gap-2 rounded-full border px-3 py-1.5 text-sm transition-colors",
      isSelected
        ? "border-primary bg-primary/10 font-medium text-primary"
        : "border-border hover:bg-accent",
    )}
  >
    {provider.logo ? (
      <Image src={provider.logo} alt="" width={16} height={16} />
    ) : (
      <EmailIcon className="h-4 w-4" />
    )}
    {provider.name}
  </button>
);

const FieldError = ({ message }) =>
  message ? <p className="mt-1 text-xs text-destructive">{message}</p> : null;

const CreateSMTP = () => {
  const formRef = useRef(null);
  const [provider, setProvider] = useState(PROVIDERS[0]);
  const [isCustomIMAP, setIsCustomIMAP] = useState(false);
  const [errors, setErrors] = useState({});
  const [loading, setLoading] = useState(false);

  const { trigger } = useSWRMutation("/api/imap/create", post, {
    onSuccess: () => {
      toast.success("Inbox connected");
      mutate("/api/google_apps");
    },
    onError: () => {
      toast.error("Could not connect this inbox. Check the credentials.");
    },
  });

  const { host, port, imap_host, secure } = provider.defaults;

  const handleCreateEmailCredentials = async (event) => {
    event.preventDefault();
    setErrors({});

    const elements = event.target.elements;
    const values = {
      username: elements.email.value.trim(),
      password: elements.password.value,
      imapEmail: elements.imapEmail?.value || elements.email.value.trim(),
      imapPassword: elements.imapPassword?.value || elements.password.value,
      port: Number.parseInt(elements.port.value),
      host: elements.host.value.trim(),
      secure: elements.secure.checked,
      imap_host: elements.imap_host.value.trim(),
    };

    const parsed = credentialSchema.safeParse(values);

    if (!parsed.success) {
      // Surface the first message per field. Without this the form silently
      // does nothing on invalid input, which reads as a broken button.
      setErrors(
        parsed.error.issues.reduce((acc, issue) => {
          const field = issue.path[0];
          if (field && !acc[field]) acc[field] = issue.message;
          return acc;
        }, {}),
      );
      return;
    }

    setLoading(true);

    try {
      await trigger(values);
      formRef.current?.reset();
      setIsCustomIMAP(false);
    } catch {
      // The mutation's onError already reported it.
    } finally {
      setLoading(false);
    }
  };

  return (
    <form ref={formRef} onSubmit={handleCreateEmailCredentials}>
      <div className="flex flex-col gap-4">
        <div>
          <Label className="mb-2">Provider</Label>
          <div className="flex flex-wrap gap-2">
            {PROVIDERS.map((item) => (
              <ProviderChip
                key={item.name}
                provider={item}
                isSelected={item.name === provider.name}
                onSelect={setProvider}
              />
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <Label>Email</Label>
            <Input name="email" placeholder="you@gmail.com" />
            <FieldError message={errors.username} />
          </div>
          <div>
            <div className="flex items-center justify-between">
              <Label>
                {provider.name === "Gmail" ? "App password" : "Password"}
              </Label>
              {provider.name === "Gmail" && (
                <Link
                  href={
                    "https://webease.tech/blogs/here-s-how-to-create-google-app-password"
                  }
                  target="_blank"
                  className="text-xs text-blue-600 hover:underline"
                >
                  How to create one
                </Link>
              )}
            </div>
            <Input name="password" type="password" placeholder="••••••••" />
            <FieldError message={errors.password} />
          </div>
        </div>

        {/* Keyed on the provider so switching resets the host/port defaults.
            Uncontrolled inputs ignore a changed defaultValue otherwise. */}
        <div key={provider.name} className="grid grid-cols-2 gap-4">
          <div>
            <Label>Host</Label>
            <Input
              name="host"
              defaultValue={host}
              placeholder="smtp.gmail.com"
            />
            <FieldError message={errors.host} />
          </div>
          <div>
            <Label>Port</Label>
            <Input
              name="port"
              type="number"
              defaultValue={port}
              placeholder="587"
            />
            <FieldError message={errors.port} />
          </div>
          <div>
            <Label>IMAP host</Label>
            <Input
              name="imap_host"
              type="text"
              defaultValue={imap_host}
              placeholder="imap.gmail.com"
            />
            <FieldError message={errors.imap_host} />
          </div>
          <div className="flex items-center gap-2 pt-6">
            <input type="checkbox" name="secure" defaultChecked={secure} />
            <Label>Secure connection (SSL/TLS)</Label>
          </div>
        </div>

        <div className="flex items-start gap-2">
          <input
            id="custom-imap"
            type="checkbox"
            checked={isCustomIMAP}
            onChange={() => setIsCustomIMAP(!isCustomIMAP)}
          />
          <Label htmlFor="custom-imap">I have different IMAP settings</Label>
        </div>
        {isCustomIMAP && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <Label>IMAP email</Label>
              <Input name="imapEmail" placeholder="you@gmail.com" />
            </div>
            <div>
              <Label>IMAP password</Label>
              <Input
                name="imapPassword"
                type="password"
                placeholder="••••••••"
              />
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button type="submit" disabled={loading} className="gap-2">
            {loading && <LoadingSpinner />}
            Connect inbox
          </Button>
        </div>
      </div>
    </form>
  );
};

export default CreateSMTP;
