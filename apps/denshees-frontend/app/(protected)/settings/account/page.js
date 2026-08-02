"use client";

import { useEffect } from "react";
import { PanelSkeleton } from "@/components/skeletons";
import { useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  SaveFloppyIcon,
  UserIcon,
  EyeIcon,
  EyeOffIcon,
} from "mage-icons-react/bulk";
import { ReloadIcon } from "mage-icons-react/stroke";
import { useState } from "react";
import useSWR from "swr";
import fetcher from "@/lib/fetcher";
import useSWRMutation from "swr/mutation";
import { patch, post } from "@/lib/apis";
import { toast } from "sonner";
import { PageHeader } from "@/components/page-header";

export default function AccountSettingsPage() {
  return (
    <div className="space-y-4">
      <PageHeader
        title="Your account"
        description="Update your profile details and password"
      />

      <div className="space-y-6">
        <AccountSettings />
        <PasswordSettings />
      </div>
    </div>
  );
}

function AccountSettings() {
  const [showApiKey, setShowApiKey] = useState(false);

  // Setup react-hook-form
  const {
    register,
    handleSubmit,
    formState: { errors },
    reset,
    setValue,
  } = useForm({
    defaultValues: {
      name: "",
      username: "",
      millionVerifierApiKey: "",
    },
  });

  // Fetch user account data
  const {
    data: userData,
    isLoading,
    error,
    mutate: refreshUserData,
  } = useSWR("/api/account", fetcher);

  // Setup mutation for updating user account
  const { trigger: updateAccount, isMutating: isUpdating } = useSWRMutation(
    "/api/account",
    patch,
    {
      onSuccess: () => {
        toast.success("Account updated successfully");
        refreshUserData();
      },
      onError: (error) => {
        toast.error("Failed to update account");
        console.error("Update error:", error);
      },
    },
  );

  // Update form data when user data is loaded
  useEffect(() => {
    if (userData) {
      setValue("name", userData.name || "");
      setValue("username", userData.username || "");
      setValue("millionVerifierApiKey", userData.millionVerifierApiKey || "");
    }
  }, [userData, setValue]);

  const onSubmit = async (data) => {
    try {
      await updateAccount({
        name: data.name,
        username: data.username,
        millionVerifierApiKey: data.millionVerifierApiKey || null,
      });
    } catch (error) {
      console.error("Error updating account:", error);
    }
  };

  if (isLoading) {
    return <PanelSkeleton lines={4} />;
  }

  if (error) {
    return (
      <div className="border border-border bg-white p-6 rounded-lg">
        <div className="flex flex-col justify-center items-center h-40">
          <p className="text-lg text-red-600">
            Failed to load account information
          </p>
          <Button onClick={() => refreshUserData()} className="mt-4">
            Retry
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div id="account-settings" className="space-y-6">
      <div className="border border-border bg-white p-6 rounded-lg">
        <div className="mb-6 flex items-center justify-between gap-3">
          <div>
            <h2 className="text-xl font-bold">Account Information</h2>
            <p className="text-sm text-foreground mt-1">
              Your name, username, and how leads get verified.
            </p>
          </div>
          <Button
            type="submit"
            form="account-info-form"
            disabled={isUpdating}
            className="flex shrink-0 items-center"
          >
            {isUpdating ? (
              <>
                <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
                Saving...
              </>
            ) : (
              <>
                <SaveFloppyIcon className="h-4 w-4 mr-2" />
                Save Changes
              </>
            )}
          </Button>
        </div>

        <form
          id="account-info-form"
          onSubmit={handleSubmit(onSubmit)}
          className="space-y-6"
        >
          <div className="flex items-start gap-6">
            <div className="relative shrink-0">
              <div className="w-24 h-24 rounded-full bg-muted flex items-center justify-center overflow-hidden border-2 border-border">
                {userData?.avatar ? (
                  <img
                    src={userData.avatar || "/placeholder.svg"}
                    alt="Profile"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <UserIcon className="h-12 w-12 text-muted-foreground" />
                )}
              </div>
              <Button
                type="button"
                size="sm"
                className="absolute bottom-0 right-0 rounded-full h-8 w-8 p-0"
                onClick={() =>
                  toast.info("Profile picture upload not implemented")
                }
              >
                +
              </Button>
            </div>

            <div className="flex-1 space-y-4">
              <div className="space-y-2">
                <Label htmlFor="name">Name</Label>
                <Input
                  id="name"
                  {...register("name", { required: "Name is required" })}
                  className={errors.name ? "border-red-500" : ""}
                />
                {errors.name && (
                  <p className="text-red-500 text-sm">{errors.name.message}</p>
                )}
              </div>

              <div className="space-y-2">
                <Label htmlFor="username">Username</Label>
                <Input
                  id="username"
                  {...register("username", {
                    required: "Username is required",
                  })}
                  className={errors.username ? "border-red-500" : ""}
                />
                {errors.username && (
                  <p className="text-red-500 text-sm">
                    {errors.username.message}
                  </p>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <Label htmlFor="millionVerifierApiKey">
              MillionVerifier API Key
            </Label>
            <div className="relative">
              <Input
                id="millionVerifierApiKey"
                type={showApiKey ? "text" : "password"}
                placeholder="Enter your MillionVerifier API key"
                {...register("millionVerifierApiKey")}
                className="pr-10"
              />
              <button
                type="button"
                onClick={() => setShowApiKey((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                tabIndex={-1}
              >
                {showApiKey ? (
                  <EyeOffIcon className="h-4 w-4" />
                ) : (
                  <EyeIcon className="h-4 w-4" />
                )}
              </button>
            </div>
            <p className="text-xs text-muted-foreground">
              Used to verify email addresses when adding leads. Get your key at{" "}
              <a
                href="https://app.millionverifier.com"
                target="_blank"
                rel="noopener noreferrer"
                className="underline"
              >
                millionverifier.com
              </a>
              .
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input id="email" value={userData?.email || ""} disabled />
            </div>

            <div className="space-y-2">
              <Label htmlFor="accountCreated">Account Created</Label>
              <Input
                id="accountCreated"
                value={
                  userData?.created
                    ? new Date(userData.created).toLocaleDateString()
                    : "N/A"
                }
                disabled
              />
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}

function PasswordSettings() {
  const { data: userData, mutate: refreshUserData } = useSWR(
    "/api/account",
    fetcher,
  );
  const hasPassword = userData?.hasPassword;

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm({
    defaultValues: {
      currentPassword: "",
      newPassword: "",
      confirmPassword: "",
    },
  });

  const { trigger: updatePassword, isMutating } = useSWRMutation(
    "/api/account/password",
    post,
    {
      onSuccess: () => {
        toast.success("Password updated successfully");
        reset();
        refreshUserData();
      },
      onError: (error) => {
        toast.error(
          error?.response?.data?.error || "Failed to update password",
        );
      },
    },
  );

  const onSubmit = async (data) => {
    if (data.newPassword !== data.confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }
    try {
      await updatePassword({
        currentPassword: data.currentPassword || undefined,
        newPassword: data.newPassword,
      });
    } catch {
      // handled by onError
    }
  };

  return (
    <div className="border border-border bg-white p-6 rounded-lg">
      <div className="mb-6 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-xl font-bold">
            {hasPassword ? "Change password" : "Set a password"}
          </h2>
          <p className="text-sm text-foreground mt-1">
            {hasPassword
              ? "Update the password used for email & password login."
              : "Set a password to enable email & password login in addition to Google sign-in."}
          </p>
        </div>
        <Button
          type="submit"
          form="password-form"
          disabled={isMutating}
          className="flex shrink-0 items-center"
        >
          {isMutating ? (
            <>
              <ReloadIcon className="h-4 w-4 mr-2 animate-spin" />
              Saving...
            </>
          ) : (
            <>
              <SaveFloppyIcon className="h-4 w-4 mr-2" />
              {hasPassword ? "Update password" : "Set password"}
            </>
          )}
        </Button>
      </div>

      <form
        id="password-form"
        onSubmit={handleSubmit(onSubmit)}
        className="space-y-6"
      >
        {hasPassword && (
          <div className="space-y-2">
            <Label htmlFor="currentPassword">Current password</Label>
            <Input
              id="currentPassword"
              type="password"
              autoComplete="current-password"
              {...register("currentPassword", {
                required: "Current password is required",
              })}
              className={errors.currentPassword ? "border-red-500" : ""}
            />
            {errors.currentPassword && (
              <p className="text-red-500 text-sm">
                {errors.currentPassword.message}
              </p>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="space-y-2">
            <Label htmlFor="newPassword">New password</Label>
            <Input
              id="newPassword"
              type="password"
              autoComplete="new-password"
              {...register("newPassword", {
                required: "New password is required",
                minLength: {
                  value: 8,
                  message: "Password must be at least 8 characters",
                },
              })}
              className={errors.newPassword ? "border-red-500" : ""}
            />
            {errors.newPassword && (
              <p className="text-red-500 text-sm">
                {errors.newPassword.message}
              </p>
            )}
          </div>

          <div className="space-y-2">
            <Label htmlFor="confirmPassword">Confirm new password</Label>
            <Input
              id="confirmPassword"
              type="password"
              autoComplete="new-password"
              {...register("confirmPassword", {
                required: "Please confirm your password",
              })}
              className={errors.confirmPassword ? "border-red-500" : ""}
            />
            {errors.confirmPassword && (
              <p className="text-red-500 text-sm">
                {errors.confirmPassword.message}
              </p>
            )}
          </div>
        </div>
      </form>
    </div>
  );
}
