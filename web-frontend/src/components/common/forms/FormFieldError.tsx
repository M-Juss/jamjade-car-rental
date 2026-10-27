type FormFieldErrorProps = {
  message?: string;
};

export function FormFieldError({ message }: FormFieldErrorProps) {
  if (!message) return null;

  return (
    <p role="alert" className="mt-1.5 min-w-0 px-1 text-[10.5px] font-medium leading-tight text-destructive">
      {message}
    </p>
  );
}
