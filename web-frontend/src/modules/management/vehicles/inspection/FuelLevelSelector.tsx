type FuelLevelSelectorProps = {
  value: number | null;
  onChange: (value: number) => void;
  disabled?: boolean;
  error?: string;
};

export function FuelLevelSelector({
  value,
  onChange,
  disabled,
  error,
}: FuelLevelSelectorProps) {
  return (
    <div id="condition-fuel-level" tabIndex={-1} className="scroll-mt-4 outline-none">
      <div className="mb-2 flex items-center justify-between">
        <span className="text-xs font-semibold text-muted-foreground">Fuel Level</span>
        <span className="text-xs font-semibold text-foreground">
          {value === null ? "Select a level" : value === 0 ? "Empty (0/8)" : `${value}/8`}
        </span>
      </div>
      <div className="flex min-w-0 gap-2" role="radiogroup" aria-label="Fuel level">
        <button
          type="button"
          role="radio"
          aria-checked={value === 0}
          aria-label="Empty, 0 out of 8 fuel level"
          disabled={disabled}
          className={`min-h-11 w-12 shrink-0 rounded-lg border px-1 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
            value === 0
              ? "border-primary bg-primary text-primary-foreground"
              : "border-border bg-surface text-muted-foreground hover:border-primary/60"
          }`}
          onClick={() => onChange(0)}
        >
          E
        </button>
        <div className="grid min-w-0 flex-1 grid-cols-8 gap-1">
          {Array.from({ length: 8 }, (_, index) => index + 1).map((fuelLevel) => {
            const filled = value !== null && value > 0 && fuelLevel <= value;

            return (
              <button
                key={fuelLevel}
                type="button"
                role="radio"
                aria-checked={value === fuelLevel}
                aria-label={`${fuelLevel} out of 8 fuel level`}
                disabled={disabled}
                className={`min-h-11 min-w-0 rounded-md border px-0.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60 ${
                  filled
                    ? "border-primary bg-primary text-primary-foreground"
                    : "border-border bg-surface text-muted-foreground hover:border-primary/60"
                }`}
                onClick={() => onChange(fuelLevel)}
              >
                {fuelLevel}
              </button>
            );
          })}
        </div>
      </div>
      <div className="mt-1.5 flex justify-between pl-14 text-xs font-semibold text-muted-foreground">
        <span>Low</span>
        <span>Full</span>
      </div>
      {error && <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>}
    </div>
  );
}
