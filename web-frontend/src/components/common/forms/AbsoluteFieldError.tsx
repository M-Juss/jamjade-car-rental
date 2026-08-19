type AbsoluteFieldErrorProps = {
  message?: string;
};

export function AbsoluteFieldError({ message }: AbsoluteFieldErrorProps) {
  if (!message) return null;

  return (
    <p className="pointer-events-none absolute bottom-0 left-1 text-[10.5px] font-medium leading-tight text-rose-500">
      {message}
    </p>
  );
}
