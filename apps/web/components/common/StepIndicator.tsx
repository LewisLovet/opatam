'use client';

interface Step {
  label: string;
  description?: string;
}

interface StepIndicatorProps {
  steps: Step[];
  currentStep: number;
  className?: string;
}

export function StepIndicator({ steps, currentStep, className = '' }: StepIndicatorProps) {
  return (
    <nav aria-label="Progression" className={className}>
      <ol className="flex items-start relative">
        {/* Background line connecting all steps */}
        <div
          className="absolute top-4 left-4 right-4 h-0.5 bg-gray-200 dark:bg-gray-700 -translate-y-1/2"
          style={{ left: '16px', right: '16px' }}
          aria-hidden="true"
        />
        {/* Progress line */}
        <div
          className="absolute top-4 h-0.5 bg-primary-600 -translate-y-1/2 transition-all duration-300"
          style={{
            left: '16px',
            width: `calc(${((currentStep - 1) / (steps.length - 1)) * 100}% - ${currentStep === 1 ? 0 : 0}px)`,
          }}
          aria-hidden="true"
        />

        {steps.map((step, index) => {
          const stepNumber = index + 1;
          const isCompleted = stepNumber < currentStep;
          const isCurrent = stepNumber === currentStep;
          const isLast = index === steps.length - 1;

          return (
            <li
              key={step.label}
              className={`flex items-start relative z-10 ${isLast ? '' : 'flex-1'}`}
            >
              <div className="flex flex-col items-center">
                {/* Step Circle */}
                <div
                  className={`
                    relative flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-medium transition-colors duration-200
                    ${
                      isCompleted
                        ? 'bg-primary-600 text-white'
                        : isCurrent
                          ? 'border-2 border-primary-600 bg-white dark:bg-gray-800 text-primary-600'
                          : 'border-2 border-gray-300 dark:border-gray-600 bg-white dark:bg-gray-800 text-gray-500 dark:text-gray-400'
                    }
                  `}
                >
                  {isCompleted ? (
                    <svg className="h-5 w-5" viewBox="0 0 20 20" fill="currentColor">
                      <path
                        fillRule="evenodd"
                        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                        clipRule="evenodd"
                      />
                    </svg>
                  ) : (
                    stepNumber
                  )}
                </div>

                {/* Step Label (visible on larger screens) */}
                <div className="hidden sm:block mt-2 text-center">
                  <span
                    className={`
                      text-xs font-medium
                      ${
                        isCompleted || isCurrent
                          ? 'text-primary-600 dark:text-primary-400'
                          : 'text-gray-500 dark:text-gray-400'
                      }
                    `}
                  >
                    {step.label}
                  </span>
                  {step.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 max-w-[120px]">
                      {step.description}
                    </p>
                  )}
                </div>
              </div>
            </li>
          );
        })}
      </ol>

      {/* Mobile Step Label */}
      <div className="sm:hidden mt-4 text-center">
        <span className="text-sm font-medium text-primary-600 dark:text-primary-400">
          Etape {currentStep} : {steps[currentStep - 1]?.label}
        </span>
      </div>
    </nav>
  );
}
