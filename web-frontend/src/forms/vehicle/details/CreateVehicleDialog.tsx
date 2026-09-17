"use client";

import { useEffect, useRef, useState } from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type FieldErrors,
  type Path,
  useForm,
  useWatch,
} from "react-hook-form";
import { appToast } from "@/lib/toast";
import {
  Upload,
  Car,
  PhilippinePeso,
  Users,
  Settings2,
  Check,
  Wind,
  Bluetooth,
  Navigation,
  Camera,
  ParkingCircle,
  Usb,
  Wifi,
  Armchair,
  Video,
  Gauge as CruiseIcon,
  Shield,
  Key,
  Zap,
  Baby,
  Leaf,
  Mountain,
} from "lucide-react";
import {
  Dialog,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { VehicleImageGallery } from "@/modules/management/vehicles/components/VehicleImageGallery";
import { AbsoluteFieldError } from "@/components/common/forms/AbsoluteFieldError";
import {
  FormDialogContent,
  FormDialogFooter,
  FormDialogHeader,
} from "@/components/common/forms/FormDialogLayout";
import { VehicleConditionForm } from "@/modules/management/vehicles/inspection";
import { ApiError } from "@/services/http";
import {
  vehicleFormSchema,
  vehicleInformationSchema,
  createVehicleConditionDefaults,
  type VehicleConditionFormValues,
  type VehicleFormValues,
} from "@/validations/vehicle/schemas";

const FEATURES = [
  { id: "ac", label: "Air Conditioning", icon: Wind },
  { id: "bluetooth", label: "Bluetooth", icon: Bluetooth },
  { id: "carplay", label: "Apple CarPlay", icon: Car },
  { id: "android", label: "Android Auto", icon: Car },
  { id: "gps", label: "GPS Navigation", icon: Navigation },
  { id: "reverse", label: "Reverse Camera", icon: Camera },
  { id: "parking", label: "Parking Sensors", icon: ParkingCircle },
  { id: "usb", label: "USB Charging", icon: Usb },
  { id: "wireless", label: "Wireless Charging", icon: Wifi },
  { id: "leather", label: "Leather Seats", icon: Armchair },
  { id: "dashcam", label: "Dashcam", icon: Video },
  { id: "cruise", label: "Cruise Control", icon: CruiseIcon },
  { id: "abs", label: "ABS Brakes", icon: Shield },
  { id: "airbag", label: "Airbags", icon: Shield },
  { id: "pushstart", label: "Push Start", icon: Key },
  { id: "keyless", label: "Keyless Entry", icon: Key },
  { id: "childseat", label: "Child Seat", icon: Baby },
  { id: "fueleff", label: "Fuel Efficient", icon: Leaf },
  { id: "petfriendly", label: "Pet Friendly", icon: Leaf },
  { id: "awd", label: "4WD / AWD", icon: Mountain },
];

const BRANDS = [
  "Toyota",
  "Honda",
  "Mitsubishi",
  "Ford",
  "Hyundai",
  "Nissan",
  "Kia",
  "Mazda",
  "Suzuki",
  "Isuzu",
];

const INITIAL_FORM: VehicleFormValues = {
  brand: "",
  name: "",
  model: "",
  plate_number: "",
  description: "",
  price_per_day: "",
  seats: "",
  color: "",
  transmission: "",
  fuel_type: "",
  status: "available",
  features: [],
  images: [],
  initial_condition: createVehicleConditionDefaults(),
};

const STATUS_OPTIONS = [
  { value: "available", label: "Available" },
  { value: "unavailable", label: "Unavailable" },
  { value: "maintenance", label: "Maintenance" },
];

const MAX_VEHICLE_IMAGES = 5;
const VEHICLE_IMAGE_TARGET_BYTES = 350 * 1024;
const VEHICLE_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
const VEHICLE_IMAGE_TOTAL_BYTES = 10 * 1024 * 1024;
const VEHICLE_IMAGE_DIMENSIONS = [1600, 1200, 1000, 800];
const VEHICLE_IMAGE_QUALITIES = [0.82, 0.72, 0.62, 0.52, 0.44];

type VehicleFormDialogProps = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  onSave?: (data: VehicleFormValues) => Promise<void> | void;
};

function fieldMessage(message: unknown) {
  return typeof message === "string" ? message : undefined;
}

function getVehicleSaveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    if (error.errors && Object.keys(error.errors).length > 0) {
      return "The vehicle could not be added. Check the highlighted fields.";
    }

    if (error.status === 0) {
      return "The vehicle could not be added. Check your connection and try again.";
    }
  }

  return "The vehicle could not be added. Please try again.";
}

function getVehicleFormErrorMessage(errors: FieldErrors<VehicleFormValues>) {
  const messages = [
    errors.images?.message,
    errors.brand?.message,
    errors.name?.message,
    errors.model?.message,
    errors.plate_number?.message,
    errors.price_per_day?.message,
    errors.description?.message,
    errors.seats?.message,
    errors.color?.message,
    errors.transmission?.message,
    errors.fuel_type?.message,
    errors.features?.message,
    errors.status?.message,
    errors.initial_condition ? "Complete the required initial condition fields." : undefined,
  ];

  return messages.find((message): message is string => typeof message === "string")
    ?? "Please check the highlighted fields.";
}

const VEHICLE_FIELD_TARGETS: Partial<Record<keyof VehicleFormValues, string>> = {
  images: "vehicle-images",
  brand: "vehicle-brand",
  name: "vehicle-name",
  model: "vehicle-model",
  plate_number: "vehicle-plate-number",
  description: "vehicle-description",
  price_per_day: "vehicle-price",
  seats: "vehicle-seats",
  color: "vehicle-color",
  transmission: "vehicle-transmission",
  fuel_type: "vehicle-fuel",
  features: "vehicle-features",
  status: "vehicle-status",
};

function focusTarget(targetId?: string) {
  if (!targetId) return;

  const target = document.getElementById(targetId);
  if (!target) return;

  target.scrollIntoView({ behavior: "smooth", block: "center" });
  if (target instanceof HTMLElement) {
    target.focus({ preventScroll: true });
  }
}

function firstVehicleErrorTarget(errors: FieldErrors<VehicleFormValues>) {
  return Object.keys(VEHICLE_FIELD_TARGETS).find(
    (field) => errors[field as keyof VehicleFormValues],
  ) as keyof VehicleFormValues | undefined;
}

function firstConditionErrorTarget(
  errors?: FieldErrors<VehicleConditionFormValues>,
) {
  if (!errors) return undefined;
  if (errors.odometer) return "condition-odometer";
  if (errors.fuel_level) return "condition-fuel-level";
  if (errors.checklist) return "condition-checklist";
  if (errors.markers) return "condition-body";
  if (errors.comments) return "condition-comments-section";
  if (errors.signature_data) return "condition-signature";

  return undefined;
}

function vehicleImageFileName(file: File) {
  const baseName = file.name.replace(/\.[^.]+$/, "").trim() || "vehicle-image";

  return `${baseName}.jpg`;
}

function loadVehicleImage(file: File) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve(image);
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Unable to read image."));
    };
    image.src = url;
  });
}

function canvasToBlob(canvas: HTMLCanvasElement, quality: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob);
          return;
        }

        reject(new Error("Unable to prepare image."));
      },
      "image/jpeg",
      quality,
    );
  });
}

async function renderVehicleImage(
  image: HTMLImageElement,
  maxDimension: number,
  quality: number,
) {
  const scale = Math.min(
    1,
    maxDimension / Math.max(image.naturalWidth, image.naturalHeight),
  );
  const width = Math.max(1, Math.round(image.naturalWidth * scale));
  const height = Math.max(1, Math.round(image.naturalHeight * scale));
  const canvas = document.createElement("canvas");
  const context = canvas.getContext("2d");

  if (!context) {
    throw new Error("Unable to prepare image.");
  }

  canvas.width = width;
  canvas.height = height;
  context.fillStyle = "#FFFFFF";
  context.fillRect(0, 0, width, height);
  context.drawImage(image, 0, 0, width, height);

  return canvasToBlob(canvas, quality);
}

async function prepareVehicleImage(file: File) {
  if (file.size <= VEHICLE_IMAGE_TARGET_BYTES) {
    return file;
  }

  let image: HTMLImageElement;

  try {
    image = await loadVehicleImage(file);
  } catch (error) {
    if (file.size <= VEHICLE_IMAGE_MAX_BYTES) {
      return file;
    }

    throw error;
  }

  let smallestBlob: Blob | null = null;

  for (const dimension of VEHICLE_IMAGE_DIMENSIONS) {
    for (const quality of VEHICLE_IMAGE_QUALITIES) {
      const blob = await renderVehicleImage(image, dimension, quality);

      if (!smallestBlob || blob.size < smallestBlob.size) {
        smallestBlob = blob;
      }

      if (blob.size <= VEHICLE_IMAGE_TARGET_BYTES) {
        return new File([blob], vehicleImageFileName(file), {
          type: "image/jpeg",
          lastModified: Date.now(),
        });
      }
    }
  }

  if (!smallestBlob) {
    return file;
  }

  return new File([smallestBlob], vehicleImageFileName(file), {
    type: "image/jpeg",
    lastModified: Date.now(),
  });
}

export function VehicleFormDialog({
  open,
  onOpenChange,
  onSave,
}: VehicleFormDialogProps) {
  const [dragOver, setDragOver] = useState(false);
  const [imagePreviews, setImagePreviews] = useState<string[]>([]);
  const [fileInputKey, setFileInputKey] = useState(0);
  const [isProcessingImages, setIsProcessingImages] = useState(false);
  const [step, setStep] = useState<"vehicle" | "condition">("vehicle");
  const [conditionValidationAttempted, setConditionValidationAttempted] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    getValues,
    clearErrors,
    control,
    reset,
    formState: { errors, isSubmitting },
  } = useForm<VehicleFormValues>({
    resolver: zodResolver(vehicleFormSchema),
    defaultValues: INITIAL_FORM,
  });

  const selectedFeatures = useWatch({ control, name: "features" }) ?? [];
  const selectedBrand = useWatch({ control, name: "brand" });
  const selectedTransmission = useWatch({ control, name: "transmission" });
  const selectedFuelType = useWatch({ control, name: "fuel_type" });
  const selectedStatus = useWatch({ control, name: "status" });
  const initialCondition = useWatch({ control, name: "initial_condition" });

  useEffect(() => {
    return () => {
      previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
      previewUrlsRef.current = [];
    };
  }, []);

  const clearImages = () => {
    previewUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    previewUrlsRef.current = [];
    setImagePreviews([]);
    setFileInputKey((key) => key + 1);
    setIsProcessingImages(false);
  };

  const resetForm = () => {
    reset(INITIAL_FORM);
    setStep("vehicle");
    setConditionValidationAttempted(false);
    clearImages();
    setDragOver(false);
  };

  const handleDialogOpenChange = (nextOpen: boolean) => {
    if (!nextOpen) {
      resetForm();
    }

    onOpenChange(nextOpen);
  };

  const handleCancel = () => {
    resetForm();
    onOpenChange(false);
  };

  const handleImages = async (files: FileList | File[] | null | undefined) => {
    if (!files || isProcessingImages || isSubmitting) return;

    const imageFiles = Array.from(files).filter((file) =>
      file.type.startsWith("image/"),
    );
    if (imageFiles.length === 0) return;

    const currentImages = getValues("images");
    const availableSlots = MAX_VEHICLE_IMAGES - currentImages.length;

    if (availableSlots <= 0) {
      appToast.error(`Vehicle images are limited to ${MAX_VEHICLE_IMAGES}.`);
      return;
    }

    const selectedImages = imageFiles.slice(0, availableSlots);

    if (imageFiles.length > availableSlots) {
      appToast.error(`Only ${MAX_VEHICLE_IMAGES} vehicle images can be uploaded.`);
    }

    setIsProcessingImages(true);

    try {
      const preparedImages = await Promise.all(
        selectedImages.map(prepareVehicleImage),
      );
      const nextImages = [...currentImages, ...preparedImages];
      const totalBytes = nextImages.reduce((total, file) => total + file.size, 0);

      if (totalBytes > VEHICLE_IMAGE_TOTAL_BYTES) {
        appToast.error("Vehicle images are too large. Remove one image or choose smaller photos.");
        return;
      }

      const nextPreviews = preparedImages.map((file) => {
        const url = URL.createObjectURL(file);
        previewUrlsRef.current.push(url);
        return url;
      });

      setValue("images", nextImages, {
        shouldDirty: true,
        shouldTouch: true,
        shouldValidate: false,
      });
      clearErrors("images");
      setImagePreviews((current) => [...current, ...nextPreviews]);
    } catch {
      appToast.error("Unable to prepare one of the selected images.");
    } finally {
      setIsProcessingImages(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    void handleImages(e.dataTransfer.files);
  };

  const removeImage = (indexToRemove: number) => {
    const images = getValues("images").filter(
      (_, index) => index !== indexToRemove,
    );
    const removedUrl = imagePreviews[indexToRemove];

    if (removedUrl) {
      URL.revokeObjectURL(removedUrl);
      previewUrlsRef.current = previewUrlsRef.current.filter(
        (url) => url !== removedUrl,
      );
    }

    setValue("images", images, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    });
    setImagePreviews((current) =>
      current.filter((_, index) => index !== indexToRemove),
    );
  };

  const toggleFeature = (feature: string) => {
    const features = getValues("features");
    const nextFeatures = features.includes(feature)
      ? features.filter((item) => item !== feature)
      : [...features, feature];

    setValue("features", nextFeatures, {
      shouldDirty: true,
      shouldTouch: true,
      shouldValidate: false,
    });
    if (nextFeatures.length > 0) clearErrors("features");
  };

  const handleSave = async (values: VehicleFormValues) => {
    try {
      await onSave?.(values);
      appToast.success("Vehicle added successfully.");
      resetForm();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        Object.entries(error.errors).forEach(([serverField, messages]) => {
          const clientField = serverField
            .replace(/\.sequence_number/g, ".sequenceNumber")
            .replace(/\.x_position/g, ".xPosition")
            .replace(/\.y_position/g, ".yPosition")
            .replace(/\.issue_type/g, ".issueType");
          const rootField = clientField.split(".")[0];

          if (rootField in INITIAL_FORM && messages[0]) {
            setError(clientField as Path<VehicleFormValues>, {
              type: "server",
              message: messages[0],
            });
          }
        });
      }

      appToast.error(getVehicleSaveErrorMessage(error));
    }
  };

  const vehicleFieldNames: Path<VehicleFormValues>[] = [
    "images",
    "brand",
    "name",
    "model",
    "plate_number",
    "description",
    "price_per_day",
    "seats",
    "color",
    "transmission",
    "fuel_type",
    "features",
    "status",
  ];

  const continueToCondition = () => {
    const result = vehicleInformationSchema.safeParse(getValues());

    clearErrors(vehicleFieldNames);
    if (!result.success) {
      result.error.issues.forEach((issue) => {
        setError(issue.path.join(".") as Path<VehicleFormValues>, {
          type: "zod",
          message: issue.message,
        });
      });
      const firstField = result.error.issues[0]?.path[0] as keyof VehicleFormValues | undefined;
      requestAnimationFrame(() => focusTarget(firstField ? VEHICLE_FIELD_TARGETS[firstField] : undefined));
      appToast.error("Please complete the highlighted vehicle information.");
      return;
    }

    clearErrors("initial_condition");
    setConditionValidationAttempted(false);
    setStep("condition");
  };

  const submitConditionForm = () => {
    setConditionValidationAttempted(true);
    void handleSubmit(handleSave, (formErrors) => {
      const conditionTarget = firstConditionErrorTarget(formErrors.initial_condition);

      if (conditionTarget) {
        requestAnimationFrame(() => focusTarget(conditionTarget));
      } else {
        const vehicleField = firstVehicleErrorTarget(formErrors);
        if (vehicleField) {
          setStep("vehicle");
          requestAnimationFrame(() => focusTarget(VEHICLE_FIELD_TARGETS[vehicleField]));
        }
      }
      appToast.error(getVehicleFormErrorMessage(formErrors));
    })();
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (step === "vehicle") {
      void continueToCondition();
      return;
    }

    submitConditionForm();
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <FormDialogContent width="wide">
        <form
          onSubmit={handleFormSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <FormDialogHeader
            title="Add Vehicle"
            icon={Car}
            onClose={handleCancel}
            closeLabel="Close vehicle form"
          />

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="space-y-5 px-4 py-4 sm:px-6 sm:py-5">
              <div className="grid grid-cols-2 gap-2 rounded-xl bg-background p-1">
                {[
                  ["vehicle", "1. Vehicle Information"],
                  ["condition", "2. Initial Condition"],
                ].map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`min-w-0 rounded-lg px-2 py-2 text-[11px] font-bold leading-4 transition-colors sm:px-3 sm:text-xs ${
                      step === value
                        ? "bg-surface text-primary shadow-sm"
                        : "text-muted-foreground"
                    }`}
                    onClick={() => {
                      if (value === "vehicle") setStep("vehicle");
                      else void continueToCondition();
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>

              {step === "vehicle" ? (
                <>
              <div className="relative pb-5">
                <Label className="text-[11.5px] font-semibold text-muted-foreground mb-2 block">
                  Vehicle Images <span className="text-rose-400">*</span>
                </Label>

                {imagePreviews.length > 0 ? (
                  <div className="space-y-3">
                    <VehicleImageGallery
                      images={imagePreviews}
                      alt="Vehicle preview"
                      onRemoveImage={removeImage}
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        onClick={() => fileRef.current?.click()}
                        disabled={isSubmitting || isProcessingImages}
                        className="px-3 py-1.5 rounded-lg bg-muted text-[12px] font-semibold text-primary hover:bg-[#DDE8FF] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isProcessingImages ? "Preparing..." : "Add more"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <div
                    id="vehicle-images"
                    role="button"
                    tabIndex={0}
                    aria-label="Upload vehicle images"
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    onKeyDown={(event) => {
                      if (event.key === "Enter" || event.key === " ") {
                        event.preventDefault();
                        fileRef.current?.click();
                      }
                    }}
                    className={`
                      relative h-40 rounded-2xl border-2 border-dashed cursor-pointer
                      flex flex-col items-center justify-center gap-2.5 transition-all duration-200
                      ${
                        dragOver
                          ? "border-primary bg-muted"
                          : "border-border bg-background hover:border-primary hover:bg-muted"
                      }
                    `}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-200 ${dragOver ? "bg-primary" : "bg-muted"}`}
                    >
                      <Upload
                        size={18}
                        className={dragOver ? "text-white" : "text-primary"}
                        strokeWidth={2}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[12.5px] font-semibold text-foreground">
                        {isProcessingImages
                          ? "Preparing images..."
                          : dragOver
                            ? "Drop to upload"
                            : "Click or drag & drop"}
                      </p>
                      <p className="text-[11px] text-subtle-foreground mt-0.5">
                        PNG, JPG, WEBP. Up to {MAX_VEHICLE_IMAGES} images.
                      </p>
                    </div>
                  </div>
                )}

                <input
                  key={fileInputKey}
                  ref={fileRef}
                  type="file"
                  accept="image/*"
                  multiple
                  disabled={isSubmitting || isProcessingImages}
                  className="hidden"
                  onChange={(e) => {
                    void handleImages(e.target.files);
                    e.target.value = "";
                  }}
                />
                <AbsoluteFieldError
                  message={fieldMessage(errors.images?.message)}
                />
              </div>

              <Separator className="bg-border" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                    <Car size={12} className="text-primary" />
                  </div>
                  <h3 className="text-[12.5px] font-bold text-foreground">
                    Basic Information
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                  <div className="relative pb-5">
                    <SelectWithLabel
                      id="vehicle-brand"
                      label="Brand"
                      required
                      placeholder="Select brand"
                      options={BRANDS.map((brand) => ({
                        value: brand,
                        label: brand,
                      }))}
                      value={selectedBrand}
                      onValueChange={(value) =>
                        setValue("brand", value, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: false,
                        })
                      }
                      disabled={isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      triggerClassName="text-[12.5px] rounded-xl border-border bg-background focus:ring-primary focus:ring-1"
                    />
                    <AbsoluteFieldError message={errors.brand?.message} />
                  </div>

                  <div className="relative pb-5">
                    <InputWithLabel
                      id="vehicle-name"
                      label="Vehicle Name"
                      required
                      placeholder="e.g. Toyota Fortuner 2023"
                      disabled={isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      {...register("name")}
                    />
                    <AbsoluteFieldError message={errors.name?.message} />
                  </div>

                  <div className="relative pb-5">
                    <InputWithLabel
                      id="vehicle-model"
                      label="Model"
                      required
                      placeholder="e.g. Fortuner V"
                      disabled={isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      {...register("model")}
                    />
                    <AbsoluteFieldError message={errors.model?.message} />
                  </div>
                  <div className="relative pb-5">
                    <InputWithLabel
                      id="vehicle-plate-number"
                      label="Plate Number"
                      required
                      placeholder="e.g. ABC 1234"
                      disabled={isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      {...register("plate_number")}
                    />
                    <AbsoluteFieldError message={errors.plate_number?.message} />
                  </div>
                  <div className="relative pb-5">
                    <InputWithLabel
                      id="vehicle-price"
                      label="Price / Day (PHP)"
                      required
                      icon={<PhilippinePeso size={13} />}
                      type="number"
                      min="1"
                      placeholder="0"
                      disabled={isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      {...register("price_per_day")}
                    />
                    <AbsoluteFieldError
                      message={errors.price_per_day?.message}
                    />
                  </div>

                  <div className="relative pb-5 sm:col-span-2">
                    <TextAreaWithLabel
                      id="vehicle-description"
                      label="Description"
                      required
                      placeholder="Add a short customer-facing vehicle description."
                      disabled={isSubmitting}
                      rows={3}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      textareaClassName="min-h-[92px]"
                      {...register("description")}
                    />
                    <AbsoluteFieldError message={errors.description?.message} />
                  </div>
                </div>
              </div>

              <Separator className="bg-border" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                    <Settings2 size={12} className="text-primary" />
                  </div>
                  <h3 className="text-[12.5px] font-bold text-foreground">
                    Specifications
                  </h3>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-3 gap-y-1">
                  <div className="relative pb-5">
                    <InputWithLabel
                      id="vehicle-seats"
                      label="Seats"
                      required
                      icon={<Users size={13} />}
                      type="number"
                      min="1"
                      placeholder="e.g. 5"
                      disabled={isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      {...register("seats")}
                    />
                    <AbsoluteFieldError message={errors.seats?.message} />
                  </div>

                  <div className="relative pb-5">
                    <InputWithLabel
                      id="vehicle-color"
                      label="Color"
                      required
                      placeholder="e.g. Pearl White"
                      disabled={isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      {...register("color")}
                    />
                    <AbsoluteFieldError message={errors.color?.message} />
                  </div>

                  <div className="relative pb-5">
                    <SelectWithLabel
                      id="vehicle-transmission"
                      label="Transmission"
                      required
                      placeholder="Select"
                      options={[
                        { value: "Automatic", label: "Automatic" },
                        { value: "Manual", label: "Manual" },
                      ]}
                      value={selectedTransmission}
                      onValueChange={(value) =>
                        setValue("transmission", value, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: false,
                        })
                      }
                      disabled={isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      triggerClassName="text-[12.5px] rounded-xl border-border bg-background"
                    />
                    <AbsoluteFieldError
                      message={errors.transmission?.message}
                    />
                  </div>

                  <div className="relative pb-5">
                    <SelectWithLabel
                      id="vehicle-fuel"
                      label="Fuel Type"
                      required
                      placeholder="Select"
                      options={[
                        { value: "Gasoline", label: "Gasoline" },
                        { value: "Diesel", label: "Diesel" },
                        { value: "Hybrid", label: "Hybrid" },
                        { value: "Electric", label: "Electric" },
                      ]}
                      value={selectedFuelType}
                      onValueChange={(value) =>
                        setValue("fuel_type", value, {
                          shouldDirty: true,
                          shouldTouch: true,
                          shouldValidate: false,
                        })
                      }
                      disabled={isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                      triggerClassName="text-[12.5px] rounded-xl border-border bg-background"
                    />
                    <AbsoluteFieldError message={errors.fuel_type?.message} />
                  </div>
                </div>
              </div>

              <Separator className="bg-border" />

              <div id="vehicle-features" tabIndex={-1} className="relative scroll-mt-4 pb-5 outline-none">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                      <Zap size={12} className="text-primary" />
                    </div>
                    <h3 className="text-[12.5px] font-bold text-foreground">
                      Features <span className="text-rose-400">*</span>
                    </h3>
                  </div>
                  {selectedFeatures.length > 0 && (
                    <span className="text-[11px] font-semibold text-primary bg-muted px-2.5 py-1 rounded-lg">
                      {selectedFeatures.length} selected
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FEATURES.map(({ id, label, icon: Icon }) => {
                    const selected = selectedFeatures.includes(label);
                    return (
                      <button
                        key={id}
                        type="button"
                        onClick={() => toggleFeature(label)}
                        disabled={isSubmitting}
                        className={`
                          relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border text-center
                          transition-all duration-150 cursor-pointer group disabled:cursor-not-allowed disabled:opacity-60
                          ${
                            selected
                              ? "bg-muted border-primary shadow-[0_2px_8px_rgba(52,110,246,0.18)]"
                              : "bg-background border-border hover:border-border hover:bg-muted"
                          }
                        `}
                      >
                        {selected && (
                            <div className="absolute top-1.5 right-1.5 flex size-4 items-center justify-center rounded-full bg-primary">
                              <Check
                                size={9}
                                className="text-white"
                                strokeWidth={3}
                              />
                            </div>
                        )}

                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 ${selected ? "bg-primary" : "bg-white border border-border group-hover:border-border"}`}
                        >
                          <Icon
                            size={13}
                            className={
                              selected ? "text-white" : "text-muted-foreground"
                            }
                            strokeWidth={2}
                          />
                        </div>
                        <span
                          className={`text-[10.5px] font-semibold leading-tight ${selected ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {label}
                        </span>
                      </button>
                    );
                  })}
                </div>
                <AbsoluteFieldError
                  message={fieldMessage(errors.features?.message)}
                />
              </div>

              <Separator className="bg-border" />

              <div className="relative pb-5">
                <SelectWithLabel
                  id="vehicle-status"
                  label="Status"
                  required
                  placeholder="Select status"
                  options={STATUS_OPTIONS}
                  value={selectedStatus}
                  onValueChange={(value) =>
                    setValue("status", value as VehicleFormValues["status"], {
                      shouldDirty: true,
                      shouldTouch: true,
                      shouldValidate: false,
                    })
                  }
                  disabled={isSubmitting}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                  triggerClassName="text-[12.5px] rounded-xl border-border bg-background"
                />
                <AbsoluteFieldError message={errors.status?.message} />
              </div>
                </>
              ) : (
                <VehicleConditionForm
                  value={initialCondition}
                  errors={conditionValidationAttempted ? errors.initial_condition : undefined}
                  disabled={isSubmitting}
                  onChange={(condition) => setValue("initial_condition", condition, {
                    shouldDirty: true,
                    shouldTouch: true,
                    shouldValidate: conditionValidationAttempted,
                  })}
                />
              )}
            </div>
          </ScrollArea>

          <FormDialogFooter>
              <Button
                type="button"
                variant="outline"
                onClick={step === "condition" ? () => setStep("vehicle") : handleCancel}
                disabled={isSubmitting || isProcessingImages}
                className="border-border text-[13px] font-medium text-muted-foreground hover:bg-background"
              >
                {step === "condition" ? "Back" : "Cancel"}
              </Button>
              <Button
                type="button"
                onClick={(event) => {
                  event.preventDefault();
                  event.stopPropagation();
                  if (step === "vehicle") {
                    void continueToCondition();
                    return;
                  }

                  submitConditionForm();
                }}
                disabled={isSubmitting || isProcessingImages}
                className="bg-primary text-[13px] font-semibold text-white shadow-[0_4px_14px_rgba(52,110,246,0.28)] hover:bg-primary-hover disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Car size={14} className="mr-2" />
                {isProcessingImages
                  ? "Preparing..."
                  : isSubmitting
                    ? "Saving..."
                    : step === "vehicle"
                      ? "Continue to Condition"
                      : "Create Vehicle & Finalize Condition"}
              </Button>
          </FormDialogFooter>
        </form>
      </FormDialogContent>
    </Dialog>
  );
}
