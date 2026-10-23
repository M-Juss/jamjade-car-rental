import { cn } from "@/lib/utils";

type ManagementPageHeadingProps = {
  title: string;
  description?: string;
  className?: string;
};

export function ManagementPageHeading({ title, description, className }: ManagementPageHeadingProps) {
  return (
    <div className={cn("min-w-0", className)}>
      <h1 className="text-2xl font-bold tracking-tight text-foreground">{title}</h1>
      {description ? <p className="mt-0.5 text-sm text-muted-foreground">{description}</p> : null}
    </div>
  );
}
