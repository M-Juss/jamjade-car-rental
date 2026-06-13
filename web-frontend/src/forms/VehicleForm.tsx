"use client";

import { useEffect, useRef, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { zodResolver } from "@hookform/resolvers/zod";
import {
  type FieldErrors,
  type Path,
  useForm,
  useWatch,
} from "react-hook-form";
import { appToast as toast } from "@/lib/toast";
import {
  Upload,
  X,
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
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { InputWithLabel } from "@/components/common/InputWithLabel";
import { SelectWithLabel } from "@/components/common/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/TextAreaWithLabel";
import { VehicleImageGallery } from "@/components/common/VehicleImageGallery";
import {
  ApiError,
  GENERIC_ERROR_MESSAGE,
} from "@/services/http";
import {
  vehicleFormSchema,
  type VehicleFormValues,
} from "@/validations/vehicle.validation";

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
  description: "",
  price_per_day: "",
  seats: "",
  color: "",
  transmission: "",
  fuel_type: "",
  status: "available",
  features: [],
  images: [],
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

function AbsoluteFieldError({ message }: { message?: string }) {
  if (!message) return null;

  return (
    <p className="pointer-events-none absolute bottom-0 left-1 text-[10.5px] font-medium leading-tight text-rose-500">
      {message}
    </p>
  );
}

function fieldMessage(message: unknown) {
  return typeof message === "string" ? message : undefined;
}

function getVehicleSaveErrorMessage(error: unknown) {
  if (error instanceof ApiError) {
    return Object.values(error.errors ?? {}).flat()[0] ?? error.message;
  }

  return GENERIC_ERROR_MESSAGE;
}

function getVehicleFormErrorMessage(errors: FieldErrors<VehicleFormValues>) {
  const messages = [
    errors.images?.message,
    errors.brand?.message,
    errors.name?.message,
    errors.model?.message,
    errors.price_per_day?.message,
    errors.description?.message,
    errors.seats?.message,
    errors.color?.message,
    errors.transmission?.message,
    errors.fuel_type?.message,
    errors.features?.message,
    errors.status?.message,
  ];

  return messages.find((message): message is string => typeof message === "string")
    ?? "Please check the highlighted fields.";
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
  const fileRef = useRef<HTMLInputElement>(null);
  const previewUrlsRef = useRef<string[]>([]);

  const {
    register,
    handleSubmit,
    setValue,
    setError,
    getValues,
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
      toast.error(`Vehicle images are limited to ${MAX_VEHICLE_IMAGES}.`);
      return;
    }

    const selectedImages = imageFiles.slice(0, availableSlots);

    if (imageFiles.length > availableSlots) {
      toast.error(`Only ${MAX_VEHICLE_IMAGES} vehicle images can be uploaded.`);
    }

    setIsProcessingImages(true);

    try {
      const preparedImages = await Promise.all(
        selectedImages.map(prepareVehicleImage),
      );
      const nextImages = [...currentImages, ...preparedImages];
      const totalBytes = nextImages.reduce((total, file) => total + file.size, 0);

      if (totalBytes > VEHICLE_IMAGE_TOTAL_BYTES) {
        toast.error("Vehicle images are too large. Remove one image or choose smaller photos.");
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
        shouldValidate: true,
      });
      setImagePreviews((current) => [...current, ...nextPreviews]);
    } catch {
      toast.error("Unable to prepare one of the selected images.");
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
      shouldValidate: true,
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
      shouldValidate: true,
    });
  };

  const handleSave = async (values: VehicleFormValues) => {
    try {
      await onSave?.(values);
      toast.success("Vehicle added successfully.");
      resetForm();
      onOpenChange(false);
    } catch (error) {
      if (error instanceof ApiError && error.errors) {
        Object.entries(error.errors).forEach(([serverField, messages]) => {
          const field = serverField.split(".")[0];

          if (field in INITIAL_FORM && messages[0]) {
            setError(field as Path<VehicleFormValues>, {
              type: "server",
              message: messages[0],
            });
          }
        });
      }

      toast.error(getVehicleSaveErrorMessage(error));
    }
  };

  const handleFormSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    void handleSubmit(handleSave, (formErrors) => {
      toast.error(getVehicleFormErrorMessage(formErrors));
    })(event);
  };

  return (
    <Dialog open={open} onOpenChange={handleDialogOpenChange}>
      <DialogContent
        className="
          w-[calc(100vw-1rem)] sm:w-[calc(100vw-2rem)] lg:w-[50vw]
          max-w-[960px] sm:max-w-none p-0 gap-0 rounded-2xl border-0
          shadow-[0_24px_64px_rgba(0,0,0,0.14)]
          flex flex-col max-h-[88vh]
          [&>button]:hidden
        "
      >
        <form
          onSubmit={handleFormSubmit}
          noValidate
          className="flex min-h-0 flex-1 flex-col"
        >
          <DialogHeader className="px-6 pt-6 pb-4 flex-shrink-0 border-b border-[#F0F2F7]">
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-[#EEF4FF] flex items-center justify-center flex-shrink-0">
                  <Car size={18} className="text-[#346EF6]" strokeWidth={2.2} />
                </div>
                <div>
                  <DialogTitle className="text-[16px] font-bold text-[#1A2340] leading-tight">
                    Add Vehicle
                  </DialogTitle>
                  <DialogDescription className="text-[12px] text-[#8896A7] mt-0.5">
                    Fill in the details to add a new vehicle to the fleet.
                  </DialogDescription>
                </div>
              </div>
              <button
                type="button"
                onClick={handleCancel}
                className="w-8 h-8 rounded-xl flex items-center justify-center text-[#A0AABF] hover:text-[#4A5568] hover:bg-[#F5F5F5] transition-all duration-150 flex-shrink-0 mt-0.5"
              >
                <X size={15} />
              </button>
            </div>
          </DialogHeader>

          <ScrollArea className="flex-1 overflow-y-auto">
            <div className="px-6 py-5 space-y-5">
              <div className="relative pb-5">
                <Label className="text-[11.5px] font-semibold text-[#4A5568] mb-2 block">
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
                        className="px-3 py-1.5 rounded-lg bg-[#EEF4FF] text-[12px] font-semibold text-[#346EF6] hover:bg-[#DDE8FF] transition-colors disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {isProcessingImages ? "Preparing..." : "Add more"}
                      </button>
                    </div>
                  </div>
                ) : (
                  <motion.div
                    whileHover={{ scale: 1.005 }}
                    onDragOver={(e) => {
                      e.preventDefault();
                      setDragOver(true);
                    }}
                    onDragLeave={() => setDragOver(false)}
                    onDrop={handleDrop}
                    onClick={() => fileRef.current?.click()}
                    className={`
                      relative h-40 rounded-2xl border-2 border-dashed cursor-pointer
                      flex flex-col items-center justify-center gap-2.5 transition-all duration-200
                      ${
                        dragOver
                          ? "border-[#346EF6] bg-[#EEF4FF]"
                          : "border-[#D1D5E0] bg-[#F8F9FC] hover:border-[#346EF6] hover:bg-[#F0F5FF]"
                      }
                    `}
                  >
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center transition-colors duration-200 ${dragOver ? "bg-[#346EF6]" : "bg-[#EEF4FF]"}`}
                    >
                      <Upload
                        size={18}
                        className={dragOver ? "text-white" : "text-[#346EF6]"}
                        strokeWidth={2}
                      />
                    </div>
                    <div className="text-center">
                      <p className="text-[12.5px] font-semibold text-[#1A2340]">
                        {isProcessingImages
                          ? "Preparing images..."
                          : dragOver
                            ? "Drop to upload"
                            : "Click or drag & drop"}
                      </p>
                      <p className="text-[11px] text-[#A0AABF] mt-0.5">
                        PNG, JPG, WEBP. Up to {MAX_VEHICLE_IMAGES} images.
                      </p>
                    </div>
                  </motion.div>
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

              <Separator className="bg-[#F0F2F7]" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                    <Car size={12} className="text-[#346EF6]" />
                  </div>
                  <h3 className="text-[12.5px] font-bold text-[#1A2340]">
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
                          shouldValidate: true,
                        })
                      }
                      disabled={isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                      triggerClassName="h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC] focus:ring-[#346EF6] focus:ring-1"
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
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
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
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                      {...register("model")}
                    />
                    <AbsoluteFieldError message={errors.model?.message} />
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
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
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
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                      textareaClassName="min-h-[92px]"
                      {...register("description")}
                    />
                    <AbsoluteFieldError message={errors.description?.message} />
                  </div>
                </div>
              </div>

              <Separator className="bg-[#F0F2F7]" />

              <div>
                <div className="flex items-center gap-2 mb-3">
                  <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                    <Settings2 size={12} className="text-[#346EF6]" />
                  </div>
                  <h3 className="text-[12.5px] font-bold text-[#1A2340]">
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
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
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
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
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
                          shouldValidate: true,
                        })
                      }
                      disabled={isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                      triggerClassName="h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC]"
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
                          shouldValidate: true,
                        })
                      }
                      disabled={isSubmitting}
                      labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                      triggerClassName="h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC]"
                    />
                    <AbsoluteFieldError message={errors.fuel_type?.message} />
                  </div>
                </div>
              </div>

              <Separator className="bg-[#F0F2F7]" />

              <div className="relative pb-5">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded-lg bg-[#EEF4FF] flex items-center justify-center">
                      <Zap size={12} className="text-[#346EF6]" />
                    </div>
                    <h3 className="text-[12.5px] font-bold text-[#1A2340]">
                      Features <span className="text-rose-400">*</span>
                    </h3>
                  </div>
                  {selectedFeatures.length > 0 && (
                    <span className="text-[11px] font-semibold text-[#346EF6] bg-[#EEF4FF] px-2.5 py-1 rounded-lg">
                      {selectedFeatures.length} selected
                    </span>
                  )}
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {FEATURES.map(({ id, label, icon: Icon }) => {
                    const selected = selectedFeatures.includes(label);
                    return (
                      <motion.button
                        key={id}
                        type="button"
                        onClick={() => toggleFeature(label)}
                        disabled={isSubmitting}
                        whileTap={{ scale: 0.96 }}
                        className={`
                          relative flex flex-col items-center gap-1.5 px-2 py-3 rounded-xl border text-center
                          transition-all duration-150 cursor-pointer group disabled:cursor-not-allowed disabled:opacity-60
                          ${
                            selected
                              ? "bg-[#EEF4FF] border-[#346EF6] shadow-[0_2px_8px_rgba(52,110,246,0.18)]"
                              : "bg-[#F8F9FC] border-[#E8ECF4] hover:border-[#B8CEFD] hover:bg-[#F0F5FF]"
                          }
                        `}
                      >
                        <AnimatePresence>
                          {selected && (
                            <motion.div
                              initial={{ scale: 0, opacity: 0 }}
                              animate={{ scale: 1, opacity: 1 }}
                              exit={{ scale: 0, opacity: 0 }}
                              transition={{ duration: 0.15 }}
                              className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-[#346EF6] flex items-center justify-center"
                            >
                              <Check
                                size={9}
                                className="text-white"
                                strokeWidth={3}
                              />
                            </motion.div>
                          )}
                        </AnimatePresence>

                        <div
                          className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors duration-150 ${selected ? "bg-[#346EF6]" : "bg-white border border-[#E8ECF4] group-hover:border-[#B8CEFD]"}`}
                        >
                          <Icon
                            size={13}
                            className={
                              selected ? "text-white" : "text-[#8896A7]"
                            }
                            strokeWidth={2}
                          />
                        </div>
                        <span
                          className={`text-[10.5px] font-semibold leading-tight ${selected ? "text-[#346EF6]" : "text-[#4A5568]"}`}
                        >
                          {label}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
                <AbsoluteFieldError
                  message={fieldMessage(errors.features?.message)}
                />
              </div>

              <Separator className="bg-[#F0F2F7]" />

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
                      shouldValidate: true,
                    })
                  }
                  disabled={isSubmitting}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-[#4A5568]"
                  triggerClassName="h-9 text-[12.5px] rounded-xl border-[#E8ECF4] bg-[#F8F9FC]"
                />
                <AbsoluteFieldError message={errors.status?.message} />
              </div>
            </div>
          </ScrollArea>

          <div className="flex-shrink-0 border-t border-[#F0F2F7] px-6 py-4 bg-white rounded-b-2xl">
            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={handleCancel}
                disabled={isSubmitting || isProcessingImages}
                className="flex-1 rounded-xl border-[#E2E8F0] text-[#4A5568] h-10 text-[13px] font-medium hover:bg-[#F5F5F5]"
              >
                Cancel
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || isProcessingImages}
                className="flex-1 rounded-xl bg-[#346EF6] hover:bg-[#2558D8] text-white h-10 text-[13px] font-semibold shadow-[0_4px_14px_rgba(52,110,246,0.28)] transition-all duration-200 disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Car size={14} className="mr-2" />
                {isProcessingImages ? "Preparing..." : isSubmitting ? "Saving..." : "Save Vehicle"}
              </Button>
            </div>
            <p className="text-center text-[10.5px] text-[#A0AABF] mt-2.5">
              Fields marked{" "}
              <span className="text-rose-400 font-semibold">*</span> are
              required
            </p>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
