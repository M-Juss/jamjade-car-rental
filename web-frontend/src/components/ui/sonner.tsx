"use client"

import { useTheme } from "next-themes"
import { Toaster as Sonner, type ToasterProps } from "sonner"
import { CircleCheckIcon, InfoIcon, TriangleAlertIcon, CircleXIcon, Loader2Icon } from "lucide-react"

const Toaster = ({ position = "bottom-right", ...props }: ToasterProps) => {
  const { theme = "system" } = useTheme()

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      position={position}
      className="toaster group"
      closeButton
      gap={12}
      icons={{
        success: (
          <span className="cn-toast-icon">
            <CircleCheckIcon className="size-5" />
          </span>
        ),
        info: (
          <span className="cn-toast-icon">
            <InfoIcon className="size-5" />
          </span>
        ),
        warning: (
          <span className="cn-toast-icon">
            <TriangleAlertIcon className="size-5" />
          </span>
        ),
        error: (
          <span className="cn-toast-icon">
            <CircleXIcon className="size-5" />
          </span>
        ),
        loading: (
          <span className="cn-toast-icon">
            <Loader2Icon className="size-5 animate-spin" />
          </span>
        ),
      }}
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          "--border-radius": "var(--radius)",
        } as React.CSSProperties
      }
      toastOptions={{
        duration: 4200,
        classNames: {
          toast: "cn-toast",
          title: "cn-toast-title",
          description: "cn-toast-description",
          closeButton: "cn-toast-close",
        },
      }}
      {...props}
    />
  )
}

export { Toaster }
