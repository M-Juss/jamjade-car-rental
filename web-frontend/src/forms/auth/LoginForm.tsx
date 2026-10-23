"use client";

import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { Mail, Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { type FieldErrors, useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { ApiError } from "@/services/http";
import { getDashboardPathForUser, login } from "@/services/auth";
import {
  loginSchema,
  LoginSchemaFormValues,
} from "@/validations/auth/schemas";
import { appToast } from "@/lib/toast";

function withLoginFailedPrefix(message: string) {
  const trimmed = message.trim();

  if (trimmed.toLowerCase().startsWith("login failed")) {
    return trimmed;
  }

  return `Login failed. ${trimmed}`;
}

function getLoginErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.status === 0) {
      return "Login failed. Check your connection and try again.";
    }

    if (error.status === 419) {
      return "Login failed because the session expired. Please try again.";
    }

    if (error.status === 401 || error.status === 422) {
      return "Login failed. Please check your email and password, then try again.";
    }
  }

  return "Login failed. Please try again.";
}

function getValidationErrorMessage(errors: FieldErrors<LoginSchemaFormValues>) {
  const message = errors.email?.message ?? errors.password?.message;

  return message ? withLoginFailedPrefix(message) : "Login failed. Please check your details.";
}

export function LoginForm() {
  const router = useRouter();
  const {
    register: formRegister,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchemaFormValues>({
    resolver: zodResolver(loginSchema),
  });

  const onSubmit = async (data: LoginSchemaFormValues) => {
    try {
      const { user } = await login({
        ...data,
        email: data.email.trim().toLowerCase(),
      });
      const dashboardPath = getDashboardPathForUser(user);

      if (dashboardPath === "/login") {
        appToast.error("Login failed. This account does not have web admin access.");
        return;
      }

      appToast.success("Login successful.");
      router.replace(dashboardPath);
    } catch (error) {
      if (error instanceof ApiError && error.errors?.email?.[0]) {
        setError("email", {
          message: error.errors.email[0],
          type: "server",
        });
      }

      appToast.error(getLoginErrorMessage(error));
    }
  };

  const onInvalid = (errors: FieldErrors<LoginSchemaFormValues>) => {
    appToast.error(getValidationErrorMessage(errors));
  };

  return (
    <form
      noValidate
      onSubmit={handleSubmit(onSubmit, onInvalid)}
      className="flex w-full flex-col gap-4"
    >
      <InputWithLabel
        id="email"
        type="email"
        inputClassName="h-11 text-sm"
        autoCapitalize="none"
        autoComplete="email"
        maxLength={160}
        icon={<Mail size={20} />}
        label="Email"
        placeholder="Enter your Email"
        error={errors.email?.message}
        {...formRegister("email")}
      />

      <InputWithLabel
        id="password"
        type="password"
        inputClassName="h-11 text-sm"
        autoComplete="current-password"
        maxLength={255}
        icon={<Lock size={20} />}
        label="Password"
        placeholder="Enter your Password"
        error={errors.password?.message}
        {...formRegister("password")}
      />

      <button
        type="submit"
        disabled={isSubmitting}
        className="mt-1 min-h-11 rounded-sm border bg-primary hover:bg-primary-hover px-4 py-2 text-white"
      >
        {isSubmitting ? "Logging in..." : "Login"}
      </button>
    </form>
  );
}
