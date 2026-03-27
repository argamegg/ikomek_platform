import { AnimatePresence, motion } from "framer-motion";
import { cn } from "../../lib/cn";

export type TabOption = {
  key: string;
  label: string;
};

type TabsProps = {
  value: string;
  options: TabOption[];
  onChange: (value: string) => void;
  className?: string;
};

export function Tabs({ value, options, onChange, className }: TabsProps) {
  return (
    <div className={cn("ui-tabs", className)}>
      {options.map((option) => {
        const active = option.key === value;

        return (
          <button
            key={option.key}
            type="button"
            className={cn("ui-tabs__item", active && "ui-tabs__item--active")}
            onClick={() => onChange(option.key)}
          >
            <span>{option.label}</span>
            <AnimatePresence>
              {active ? (
                <motion.span
                  className="ui-tabs__pill"
                  layoutId="tabs-pill"
                  transition={{ duration: 0.22 }}
                />
              ) : null}
            </AnimatePresence>
          </button>
        );
      })}
    </div>
  );
}
