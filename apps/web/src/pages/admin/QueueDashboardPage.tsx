import { useState } from "react";
import { AppLayout } from "@/components/layout/AppLayout";
import { QueueDashboard } from "@/components/admin/queue-dashboard";
import { QueueLogsModal } from "@/components/admin/QueueLogsModal";
import { AllLogsModal } from "@/components/admin/AllLogsModal";
import { QueueConfigModal } from "@/components/admin/QueueConfigModal";
import { TriggerJobModal } from "@/components/admin/TriggerJobModal";

export function QueueDashboardPage() {
  const [showLogsModal, setShowLogsModal] = useState<{
    queueName: string;
    displayName: string;
  } | null>(null);
  const [showAllLogsModal, setShowAllLogsModal] = useState(false);
  const [configQueue, setConfigQueue] = useState<string | null>(null);
  const [triggerQueue, setTriggerQueue] = useState<string | null>(null);

  const handleViewLogs = (queueName: string, displayName: string) => {
    setShowLogsModal({ queueName, displayName });
  };

  const handleViewAllLogs = () => {
    setShowAllLogsModal(true);
  };

  const handleConfigure = (queueName: string) => {
    setConfigQueue(queueName);
  };

  const handleTriggerJob = (queueName: string) => {
    setTriggerQueue(queueName);
  };

  return (
    <AppLayout>
      <div className="container mx-auto px-4 sm:px-6 lg:px-8 py-6">
        <QueueDashboard
          onViewLogs={handleViewLogs}
          onViewAllLogs={handleViewAllLogs}
          onConfigure={handleConfigure}
          onTriggerJob={handleTriggerJob}
        />
      </div>

      {/* Modals */}
      {showLogsModal && (
        <QueueLogsModal
          queueName={showLogsModal.queueName}
          displayName={showLogsModal.displayName}
          isOpen={!!showLogsModal}
          onClose={() => setShowLogsModal(null)}
        />
      )}

      <AllLogsModal
        isOpen={showAllLogsModal}
        onClose={() => setShowAllLogsModal(false)}
      />

      {configQueue && (
        <QueueConfigModal
          queueName={configQueue}
          isOpen={!!configQueue}
          onClose={() => setConfigQueue(null)}
        />
      )}

      <TriggerJobModal
        queueName={triggerQueue}
        isOpen={!!triggerQueue}
        onClose={() => setTriggerQueue(null)}
      />
    </AppLayout>
  );
}
