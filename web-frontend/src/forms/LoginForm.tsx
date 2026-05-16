"use client";

import { InputWithLabel } from "@/components/common/InputWithLabel";
import { Mail, Lock } from "lucide-react";
import Link from "next/link";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  loginSchema,
  LoginSchemaFormValues,
} from "@/validations/auth.validation";
// import { login } from "@/lib/auth";

export function LoginForm() {
  const {
    register: formRegister,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm<LoginSchemaFormValues>({ resolver: zodResolver(loginSchema) });

  const onSubmit = async (data: LoginSchemaFormValues) => {
    try {
      // await login(data.email, data.password);
      // alert("Successful");
    } catch (err: any) {
      console.error(err);
      alert("Login Failed");
    }
  };

  return (
    <form
      onSubmit={handleSubmit(onSubmit)}
      className="w-full flex flex-col items-cente gap-5"
    >
      <InputWithLabel
        id="email"
        icon={<Mail size={20} />}
        label="Email"
        placeholder="Enter your Email"
        {...formRegister("email")}
      />
      {errors.password && <p className="text-red-500 text-xs"></p>}

      <InputWithLabel
        id="password"
        type="password"
        icon={<Lock size={20} />}
        label="Password"
        placeholder="Enter your Password"
        {...formRegister("password")}
      />
      {errors.password && <p className="text-red-500 text-xs"></p>}

      <button
        type="submit"
        disabled={isSubmitting}
        className="border text-white py-1 bg-[linear-gradient(90deg,#004bfa_0%,#346ef6_50%)] rounded-sm py-0.5 mt-1"
      >
        {isSubmitting ? "Logging in..." : "Login"}
      </button>

    </form>
  );
}
