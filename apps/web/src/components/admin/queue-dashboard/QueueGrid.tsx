import { QueueCard } from "./QueueCard";

interface QueueStats {
  name: string;
  displayName: string;
  waiting: number;
  active: number;
  completed: number;
  failed: number;
  paused?: boolean;
  error?: string;
  processingRate?: number;
  avgProcessingTime?: number;
  lastProcessed?: string;
}

interface QueueGridProps {
  queues: QueueStats[];
  onViewLogs: (queueName: string, displayName: string) => void;
  onPause: (queueName: string) => void;
  onResume: (queueName: string) => void;
  onRetryFailed: (queueName: string) => void;
  onDrain: (queueName: string) => void;
  onConfigure: (queueName: string) => void;
  onTriggerJob?: (queueName: string) => void;
}

export function QueueGrid({
  queues,
  onViewLogs,
  onPause,
  onResume,
  onRetryFailed,
  onDrain,
  onConfigure,
  onTriggerJob,
}: QueueGridProps) {
  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
      {queues.map((queue, index) => (
        <QueueCard
          key={queue.name}
          queue={queue}
          index={index}
          onViewLogs={onViewLogs}
          onPause={onPause}
          onResume={onResume}
          onRetryFailed={onRetryFailed}
          onDrain={onDrain}
          onConfigure={onConfigure}
          onTriggerJob={onTriggerJob}
        />
      ))}
    </div>
  );
}
