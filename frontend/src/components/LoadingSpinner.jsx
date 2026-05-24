/**
 * LoadingSpinner — Reusable animated rose/peach spinner.
 * size: 'sm' | 'md' | 'lg'
 * message: optional label below the spinner
 */
export default function LoadingSpinner({ size = 'md', message = '' }) {
  const dimensions = {
    sm: 'w-6 h-6 border-2',
    md: 'w-10 h-10 border-2',
    lg: 'w-16 h-16 border-[3px]',
  };

  return (
    <div className="flex flex-col items-center justify-center gap-4" role="status" aria-label="Loading">
      <div
        className={`${dimensions[size]} rounded-full border-rose-pale border-t-rose animate-spin shadow-sm`}
      />
      {message && (
        <p className="text-sm text-text-muted animate-pulse font-semibold">{message}</p>
      )}
    </div>
  );
}
