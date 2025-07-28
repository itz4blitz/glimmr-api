import { useState, useEffect } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Zap, AlertCircle, Building2, FileDown, Search } from "lucide-react";
import { toast } from "sonner";
import { apiClient } from "@/lib/api";

interface TriggerJobModalProps {
  queueName: string | null;
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
}

interface Hospital {
  id: string;
  name: string;
  state: string;
  city: string;
  externalId: string | null;
}

interface PriceFile {
  id: string;
  filename: string;
  fileUrl: string | null;
  fileType: string;
  fileSize: number | null;
  lastRetrieved: string | null;
  processingStatus: string;
}

export function TriggerJobModal({
  queueName,
  isOpen,
  onClose,
  onSuccess,
}: TriggerJobModalProps) {
  const [mode, setMode] = useState<"guided" | "manual">("guided");
  const [jobData, setJobData] = useState<string>("");
  const [jobName, setJobName] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data for guided mode
  const [hospitals, setHospitals] = useState<Hospital[]>([]);
  const [selectedHospital, setSelectedHospital] = useState<string>("");
  const [priceFiles, setPriceFiles] = useState<PriceFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<string>("");
  const [isLoadingData, setIsLoadingData] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedStates, setSelectedStates] = useState<string[]>([
    "CA",
    "FL",
    "TX",
  ]);
  const [forceRefresh, setForceRefresh] = useState(false);

  // All US states
  const ALL_STATES = [
    "AL",
    "AK",
    "AZ",
    "AR",
    "CA",
    "CO",
    "CT",
    "DE",
    "FL",
    "GA",
    "HI",
    "ID",
    "IL",
    "IN",
    "IA",
    "KS",
    "KY",
    "LA",
    "ME",
    "MD",
    "MA",
    "MI",
    "MN",
    "MS",
    "MO",
    "MT",
    "NE",
    "NV",
    "NH",
    "NJ",
    "NM",
    "NY",
    "NC",
    "ND",
    "OH",
    "OK",
    "OR",
    "PA",
    "RI",
    "SC",
    "SD",
    "TN",
    "TX",
    "UT",
    "VT",
    "VA",
    "WA",
    "WV",
    "WI",
    "WY",
  ];

  // Fetch hospitals when modal opens
  useEffect(() => {
    if (
      isOpen &&
      (queueName === "pra-file-download" || queueName === "price-file-parser")
    ) {
      fetchHospitals();
    }
  }, [isOpen, queueName]);

  // Fetch price files when hospital is selected
  useEffect(() => {
    if (selectedHospital) {
      fetchPriceFiles(selectedHospital);
    }
  }, [selectedHospital]);

  const fetchHospitals = async () => {
    setIsLoadingData(true);
    try {
      const response = await apiClient.get("/hospitals", {
        params: { limit: 100, isActive: true },
      });
      setHospitals(response.data.hospitals || []);
    } catch (error) {
      console.error('Failed to load hospitals:', error);
      toast.error("Failed to load hospitals");
    } finally {
      setIsLoadingData(false);
    }
  };

  const fetchPriceFiles = async (hospitalId: string) => {
    try {
      const response = await apiClient.get(
        `/hospitals/${hospitalId}/price-files`,
      );
      setPriceFiles(response.data || []);
    } catch (error) {
      // Price files may not be available for all hospitals
      console.error('Failed to fetch price files:', error);
    }
  };

  const getQueueDescription = (queueName: string): string => {
    const descriptions: Record<string, string> = {
      "price-file-parser":
        "Parses CSV/JSON price files and extracts pricing data",
      "price-update": "Normalizes and updates price data in the database",
      "analytics-refresh": "Refreshes analytics and aggregated metrics",
      "export-data": "Exports data to various formats",
      "pra-unified-scan":
        "Scans Patient Rights Advocate API for hospital updates",
      "pra-file-download": "Downloads files discovered by PRA scan",
    };
    return descriptions[queueName] || "Process queue jobs";
  };

  const generateJobData = () => {
    if (!queueName) return {};

    switch (queueName) {
      case "pra-file-download": {
        if (mode === "guided" && selectedHospital && selectedFile) {
          const hospital = hospitals.find((h) => h.id === selectedHospital);
          const file = priceFiles.find((f) => f.id === selectedFile);
          return {
            hospitalId: hospital?.id,
            fileId: file?.id,
            externalFileId: file?.id,
            fileUrl: file?.fileUrl,
            filename: file?.filename,
            filesuffix: file?.fileType,
            size: file?.fileSize?.toString(),
            retrieved: new Date().toISOString(),
          };
        }
        break;
      }

      case "price-file-parser": {
        if (mode === "guided" && selectedHospital && selectedFile) {
          const hospital = hospitals.find((h) => h.id === selectedHospital);
          const file = priceFiles.find((f) => f.id === selectedFile);
          return {
            fileId: file?.id,
            hospitalId: hospital?.id,
            filePath: `hospitals/${hospital?.id}/${file?.filename}`,
            fileType: file?.fileType,
            fileSize: file?.fileSize,
          };
        }
        break;
      }

      case "pra-unified-scan": {
        return {
          testMode: selectedStates.length < ALL_STATES.length, // Only use test mode if not all states
          states:
            selectedStates.length === ALL_STATES.length
              ? undefined
              : selectedStates, // undefined means all states
          forceRefresh: forceRefresh,
        };
      }

      case "price-update": {
        if (mode === "guided" && selectedHospital) {
          return {
            hospitalId: selectedHospital,
            batchSize: 100,
            forceUpdate: false,
          };
        }
        break;
      }

      case "analytics-refresh": {
        return {
          metricTypes: ["price-statistics", "hospital-metrics"],
          forceRefresh: true,
          batchSize: 100,
        };
      }

      case "export-data": {
        return {
          format: "json",
          dataset: "hospitals",
          limit: 1000,
        };
      }
    }

    return {};
  };

  const handleModeChange = (newMode: "guided" | "manual") => {
    setMode(newMode);
    if (newMode === "guided") {
      const data = generateJobData();
      setJobData(JSON.stringify(data, null, 2));
    }
  };

  const handleGuidedDataChange = () => {
    if (mode === "guided") {
      const data = generateJobData();
      setJobData(JSON.stringify(data, null, 2));
    }
  };

  useEffect(() => {
    handleGuidedDataChange();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedHospital, selectedFile, selectedStates, forceRefresh]);

  // Initialize job data when modal opens
  useEffect(() => {
    if (isOpen && queueName) {
      const defaultData = generateJobData();
      setJobData(JSON.stringify(defaultData, null, 2));
      setJobName(`manual-${queueName}-${Date.now()}`);
      setError(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, queueName]);

  const handleSubmit = async () => {
    if (!queueName) return;

    setIsSubmitting(true);
    setError(null);

    try {
      // Parse and validate JSON
      let parsedData = {};
      if (jobData.trim()) {
        try {
          parsedData = JSON.parse(jobData);
        } catch {
          setError("Invalid JSON format. Please check your job data.");
          setIsSubmitting(false);
          return;
        }
      }

      // Make API call to trigger job
      await apiClient.post(`/jobs/queue/${queueName}/add`, {
        name: jobName || `manual-${queueName}-${Date.now()}`,
        data: parsedData,
        opts: {
          priority: 5,
          attempts: 3,
          backoff: {
            type: "exponential",
            delay: 5000,
          },
        },
      });

      toast.success(`Job added to ${queueName} queue successfully`);
      onSuccess?.();
      onClose();
    } catch (error) {
      let errorMessage = "Failed to trigger job";
      
      if (error && typeof error === "object" && "response" in error) {
        const errorResponse = error as { response?: { data?: { message?: string } } };
        errorMessage = errorResponse.response?.data?.message || errorMessage;
      } else if (error instanceof Error) {
        errorMessage = error.message;
      }
      
      setError(errorMessage);
      toast.error(errorMessage);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleClose = () => {
    setJobData("");
    setJobName("");
    setError(null);
    setSelectedHospital("");
    setSelectedFile("");
    setPriceFiles([]);
    setForceRefresh(false);
    onClose();
  };

  const filteredHospitals = hospitals.filter(
    (h) =>
      h.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.city.toLowerCase().includes(searchQuery.toLowerCase()) ||
      h.state.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  if (!queueName) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-[700px] max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Zap className="h-5 w-5 text-primary" />
            Trigger Job: {queueName}
          </DialogTitle>
          <DialogDescription>
            {getQueueDescription(queueName)}
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={mode}
          onValueChange={(v) => handleModeChange(v as "guided" | "manual")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="guided">Guided Mode</TabsTrigger>
            <TabsTrigger value="manual">Manual JSON</TabsTrigger>
          </TabsList>

          <TabsContent value="guided" className="space-y-4">
            {(queueName === "pra-file-download" ||
              queueName === "price-file-parser" ||
              queueName === "price-update") && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="hospital">Select Hospital</Label>
                  <div className="flex gap-2">
                    <Input
                      placeholder="Search hospitals..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      className="flex-1"
                    />
                    <Button
                      type="button"
                      variant="outline"
                      size="icon"
                      onClick={fetchHospitals}
                      disabled={isLoadingData}
                    >
                      <Search className="h-4 w-4" />
                    </Button>
                  </div>
                  <Select
                    value={selectedHospital}
                    onValueChange={setSelectedHospital}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          isLoadingData
                            ? "Loading hospitals..."
                            : "Choose a hospital"
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {filteredHospitals.map((hospital) => (
                        <SelectItem key={hospital.id} value={hospital.id}>
                          <div className="flex items-center gap-2">
                            <Building2 className="h-4 w-4" />
                            <span>
                              {hospital.name} - {hospital.city},{" "}
                              {hospital.state}
                            </span>
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {(queueName === "pra-file-download" ||
                  queueName === "price-file-parser") &&
                  selectedHospital && (
                    <div className="space-y-2">
                      <Label htmlFor="file">Select Price File</Label>
                      <Select
                        value={selectedFile}
                        onValueChange={setSelectedFile}
                      >
                        <SelectTrigger>
                          <SelectValue
                            placeholder={
                              priceFiles.length === 0
                                ? "No files found"
                                : "Choose a file"
                            }
                          />
                        </SelectTrigger>
                        <SelectContent>
                          {priceFiles.map((file) => (
                            <SelectItem key={file.id} value={file.id}>
                              <div className="flex items-center gap-2">
                                <FileDown className="h-4 w-4" />
                                <div className="flex flex-col">
                                  <span className="font-medium">
                                    {file.filename}
                                  </span>
                                  <span className="text-xs text-muted-foreground">
                                    {file.fileType.toUpperCase()} •{" "}
                                    {file.fileSize
                                      ? `${(file.fileSize / 1024 / 1024).toFixed(2)} MB`
                                      : "Unknown size"}{" "}
                                    • {file.processingStatus}
                                  </span>
                                </div>
                              </div>
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                  )}
              </>
            )}

            {queueName === "pra-unified-scan" && (
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label>Select States to Scan</Label>
                  <div className="flex gap-2">
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedStates(ALL_STATES)}
                    >
                      Select All
                    </Button>
                    <Button
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => setSelectedStates([])}
                    >
                      Clear All
                    </Button>
                  </div>
                </div>
                <div className="border rounded-lg p-4 max-h-64 overflow-y-auto">
                  <div className="grid grid-cols-5 gap-2">
                    {ALL_STATES.map((state) => (
                      <label
                        key={state}
                        className="flex items-center gap-1.5 cursor-pointer hover:bg-secondary/50 rounded px-2 py-1"
                      >
                        <input
                          type="checkbox"
                          className="rounded border-gray-300"
                          checked={selectedStates.includes(state)}
                          onChange={(e) => {
                            if (e.target.checked) {
                              setSelectedStates([...selectedStates, state]);
                            } else {
                              setSelectedStates(
                                selectedStates.filter((s) => s !== state),
                              );
                            }
                          }}
                        />
                        <span className="text-sm font-medium">{state}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">
                  {selectedStates.length} state
                  {selectedStates.length !== 1 ? "s" : ""} selected
                  {selectedStates.length === ALL_STATES.length &&
                    " (All states)"}
                </p>

                <div className="flex items-center gap-2 mt-4">
                  <input
                    type="checkbox"
                    id="forceRefresh"
                    className="rounded border-gray-300"
                    checked={forceRefresh}
                    onChange={(e) => setForceRefresh(e.target.checked)}
                  />
                  <Label
                    htmlFor="forceRefresh"
                    className="cursor-pointer font-normal"
                  >
                    Force refresh (ignore last check time and re-scan all
                    hospitals)
                  </Label>
                </div>
              </div>
            )}

            <div className="space-y-2">
              <Label>Generated Job Data</Label>
              <Textarea
                value={jobData}
                onChange={(e) => setJobData(e.target.value)}
                className="font-mono text-sm h-48"
                readOnly={mode === "guided"}
              />
              <p className="text-xs text-muted-foreground">
                This data will be sent to the job queue. In guided mode, it's
                automatically generated based on your selections.
              </p>
            </div>
          </TabsContent>

          <TabsContent value="manual" className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="jobData">Job Data (JSON)</Label>
              <Textarea
                id="jobData"
                value={jobData}
                onChange={(e) => setJobData(e.target.value)}
                placeholder="Enter job data as JSON..."
                className="font-mono text-sm h-64"
              />
              <p className="text-xs text-muted-foreground">
                Enter the job data as valid JSON. You can switch to Guided Mode
                for help with the structure.
              </p>
            </div>
          </TabsContent>
        </Tabs>

        <div className="space-y-4">
          {error && (
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          <div className="space-y-2">
            <Label htmlFor="jobName">Job Name (optional)</Label>
            <Input
              id="jobName"
              value={jobName}
              onChange={(e) => setJobName(e.target.value)}
              placeholder={`manual-${queueName}-${Date.now()}`}
            />
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting}>
            {isSubmitting ? "Triggering..." : "Trigger Job"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}