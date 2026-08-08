"use client";

interface ProgressBarProps {
  currentStep: number;
  totalSteps: number;
}

export function ProgressBar({ currentStep, totalSteps }: ProgressBarProps) {
  return (
    <div className="flex gap-1.5 mb-8">
      {Array.from({ length: totalSteps }, (_, i) => (
        <div
          key={i}
          className={`h-1 flex-1 rounded-control transition-colors duration-200 ${
            i < currentStep ? "bg-deep-brown" : "bg-light-tan"
          }`}
        />
      ))}
    </div>
  );
}
