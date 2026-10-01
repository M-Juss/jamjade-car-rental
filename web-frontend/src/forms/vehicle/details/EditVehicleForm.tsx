"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { zodResolver } from "@hookform/resolvers/zod";
import { useForm, useWatch } from "react-hook-form";
import {
  ChevronLeft,
  Car,
  ClipboardPenLine,
  PhilippinePeso,
  Users,
  Settings2,
  Zap,
  Check,
  Save,
  X,
  Image as ImageIcon,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Separator } from "@/components/ui/separator";
import { InputWithLabel } from "@/components/common/forms/InputWithLabel";
import { SelectWithLabel } from "@/components/common/forms/SelectWithLabel";
import { TextAreaWithLabel } from "@/components/common/forms/TextAreaWithLabel";
import { VehicleImageGallery } from "@/modules/management/vehicles/components/VehicleImageGallery";
import { getVehicle, updateVehicle } from "@/services/vehicle";
import { ApiError } from "@/services/http";
import { appToast } from "@/lib/toast";
import {
  editVehicleFormSchema,
  type EditVehicleFormValues,
} from "@/validations/vehicle/schemas";
import { managementPath } from "@/modules/management/shell/config/module-registry";
import { useManagementPortal } from "@/modules/management/shell/context/ManagementSessionProvider";

const FEATURES = [
  "Air Conditioning",
  "Bluetooth",
  "Apple CarPlay",
  "Android Auto",
  "GPS Navigation",
  "Reverse Camera",
  "Parking Sensors",
  "USB Charging",
  "Wireless Charging",
  "Leather Seats",
  "Cruise Control",
];

const BRANDS = ["Toyota", "Honda", "Mitsubishi", "Ford", "Hyundai", "Nissan", "Kia", "Mazda", "Suzuki", "Isuzu"];

interface EditVehicleFormProps {
  vehicleId: string;
}

export default function EditVehicleForm({ vehicleId }: EditVehicleFormProps) {
  const router = useRouter();
  const portal = useManagementPortal();
  const vehiclePath = managementPath(portal, "vehicles") ?? "/owner/vehicle";
  const [images, setImages] = useState<string[]>([]);
  const [vehicleName, setVehicleName] = useState("");
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    register,
    reset,
    setError: setFieldError,
    setValue,
  } = useForm<EditVehicleFormValues>({
    defaultValues: {
      brand: "",
      color: "",
      description: "",
      features: [],
      fuel_type: "",
      model: "",
      name: "",
      plate_number: "",
      price_per_day: "",
      seats: "",
      transmission: "",
    },
    resolver: zodResolver(editVehicleFormSchema),
  });
  const form = useWatch({ control });
  const selectedFeatures = form.features ?? [];

  useEffect(() => {
    let ignore = false;

    async function loadVehicle() {
      try {
        setIsLoading(true);
        setError(null);
        const vehicle = await getVehicle(vehicleId);

        if (!ignore) {
          reset({
            name: vehicle.name,
            brand: vehicle.brand,
            model: vehicle.model ?? "",
            plate_number: vehicle.plateNumber ?? "",
            description: vehicle.description ?? "",
            price_per_day: String(vehicle.pricePerDay),
            seats: String(vehicle.seats),
            color: vehicle.color ?? "",
            transmission: vehicle.transmission,
            fuel_type: vehicle.fuelType,
            features: vehicle.features,
          });
          setImages(vehicle.images);
          setVehicleName(vehicle.name);
        }
      } catch {
        if (!ignore) {
          setError("Unable to load vehicle.");
        }
      } finally {
        if (!ignore) {
          setIsLoading(false);
        }
      }
    }

    void loadVehicle();

    return () => {
      ignore = true;
    };
  }, [reset, vehicleId]);

  const toggleFeature = (feature: string) => {
    const nextFeatures = selectedFeatures.includes(feature)
      ? selectedFeatures.filter((item) => item !== feature)
      : [...selectedFeatures, feature];

    setValue("features", nextFeatures, {
      shouldDirty: true,
      shouldValidate: true,
    });
  };

  const onSubmit = async (values: EditVehicleFormValues) => {
    try {
      await updateVehicle(vehicleId, values);
      appToast.success("Vehicle updated successfully.");
      router.push(`${vehiclePath}/${vehicleId}`);
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.errors) {
        Object.entries(saveError.errors).forEach(([field, messages]) => {
          const message = messages[0];

          if (field in editVehicleFormSchema.shape && message) {
            setFieldError(field as keyof EditVehicleFormValues, {
              message,
              type: "server",
            });
          }
        });
      }

      appToast.error("The vehicle could not be updated. Check the highlighted fields and try again.");
    }
  };

  return (
    <div className="p-4 md:p-6 lg:p-8 space-y-5 bg-background min-h-screen">
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(vehiclePath)}
          className="flex items-center gap-1.5 text-[12.5px] text-muted-foreground hover:text-primary transition-colors duration-150 group"
        >
          <ChevronLeft
            size={15}
            className="group-hover:-translate-x-0.5 transition-transform duration-150"
          />
          Vehicle Management
        </button>
        <span className="text-border text-sm">/</span>
        <span className="text-[12.5px] font-semibold text-foreground">
          {vehicleName || "Vehicle"}
        </span>
      </div>

      <div>
        <Card className="rounded-2xl border-0 shadow-[0_2px_16px_rgba(0,0,0,0.06)] bg-white overflow-hidden">
          <CardHeader className="flex flex-col items-stretch justify-between gap-3 border-b border-border px-5 pb-3 pt-5 sm:flex-row sm:items-center">
            <CardTitle className="flex items-center gap-2 text-[16px] font-bold text-foreground">
              <Car size={16} className="text-primary" /> {vehicleName || "Vehicle"}
            </CardTitle>
            {!isLoading && !error && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full rounded-xl border-border font-semibold text-primary sm:w-auto"
                onClick={() => router.push(`${vehiclePath}/${vehicleId}/condition`)}
              >
                <ClipboardPenLine size={14} /> Edit Vehicle Condition
              </Button>
            )}
          </CardHeader>

          <CardContent className="p-5 md:p-6 space-y-6">
            {isLoading ? (
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-[13px] font-medium text-muted-foreground">
                Loading vehicle...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-rose-100 bg-rose-50 p-8 text-center text-[13px] font-medium text-rose-700">
                {error}
              </div>
            ) : (
              <form
                className="space-y-6"
                onSubmit={handleSubmit(onSubmit, () => {
                  appToast.error("Check the highlighted vehicle fields.");
                })}
              >
            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                  <ImageIcon size={12} className="text-primary" />
                </div>
                <h3 className="text-[12.5px] font-bold text-foreground">Image Gallery</h3>
              </div>

              {images.length > 0 ? (
                <VehicleImageGallery images={images} alt={form.name ?? "Vehicle"} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-[12.5px] font-medium text-muted-foreground">
                  No images uploaded.
                </div>
              )}
            </div>

            <Separator className="bg-border" />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                  <Car size={12} className="text-primary" />
                </div>
                <h3 className="text-[12.5px] font-bold text-foreground">Basic Information</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputWithLabel
                  id="edit-vehicle-name"
                  label="Vehicle Name"
                  error={errors.name?.message}
                  {...register("name")}
                  wrapperClassName="sm:col-span-2"
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                />

                <div>
                  <SelectWithLabel
                    id="edit-vehicle-brand"
                    label="Brand"
                    placeholder="Select brand"
                    options={BRANDS.map((brand) => ({ value: brand, label: brand }))}
                    value={form.brand ?? ""}
                    error={errors.brand?.message}
                    onValueChange={(value) => {
                      setValue("brand", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                    triggerClassName="text-[12.5px] rounded-xl border-border bg-background"
                  />
                </div>

                <InputWithLabel
                  id="edit-vehicle-model"
                  label="Model"
                  error={errors.model?.message}
                  {...register("model")}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                />

                <InputWithLabel
                  id="edit-vehicle-plate-number"
                  label="Plate Number"
                  error={errors.plate_number?.message}
                  placeholder="e.g. ABC 1234"
                  {...register("plate_number")}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                />

                <InputWithLabel
                  id="edit-vehicle-price"
                  label="Price / Day (₱)"
                  icon={<PhilippinePeso size={13} />}
                  type="number"
                  error={errors.price_per_day?.message}
                  {...register("price_per_day")}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                />

                <TextAreaWithLabel
                  id="edit-vehicle-description"
                  label="Description"
                  error={errors.description?.message}
                  {...register("description")}
                  wrapperClassName="sm:col-span-2"
                  rows={3}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                  textareaClassName="min-h-[92px]"
                />
              </div>
            </div>

            <Separator className="bg-border" />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                  <Settings2 size={12} className="text-primary" />
                </div>
                <h3 className="text-[12.5px] font-bold text-foreground">Specifications</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputWithLabel
                  id="edit-vehicle-seats"
                  label="Seats"
                  icon={<Users size={13} />}
                  type="number"
                  error={errors.seats?.message}
                  {...register("seats")}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                />

                <InputWithLabel
                  id="edit-vehicle-color"
                  label="Color"
                  error={errors.color?.message}
                  {...register("color")}
                  labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                />

                <div>
                  <SelectWithLabel
                    id="edit-vehicle-transmission"
                    label="Transmission"
                    placeholder="Select"
                    options={[
                      { value: "Automatic", label: "Automatic" },
                      { value: "Manual", label: "Manual" },
                    ]}
                    value={form.transmission ?? ""}
                    error={errors.transmission?.message}
                    onValueChange={(value) => {
                      setValue("transmission", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                    triggerClassName="text-[12.5px] rounded-xl border-border bg-background"
                  />
                </div>

                <div>
                  <SelectWithLabel
                    id="edit-vehicle-fuel"
                    label="Fuel Type"
                    placeholder="Select"
                    options={[
                      { value: "Gasoline", label: "Gasoline" },
                      { value: "Diesel", label: "Diesel" },
                      { value: "Hybrid", label: "Hybrid" },
                      { value: "Electric", label: "Electric" },
                    ]}
                    value={form.fuel_type ?? ""}
                    error={errors.fuel_type?.message}
                    onValueChange={(value) => {
                      setValue("fuel_type", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    labelClassName="text-[11.5px] font-semibold tracking-normal normal-case text-muted-foreground"
                    triggerClassName="text-[12.5px] rounded-xl border-border bg-background"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <div className="w-6 h-6 rounded-lg bg-muted flex items-center justify-center">
                    <Zap size={12} className="text-primary" />
                  </div>
                  <h3 className="text-[12.5px] font-bold text-foreground">Features</h3>
                </div>
                <span className="text-[11px] font-semibold text-primary bg-muted px-2.5 py-1 rounded-lg">
                  {selectedFeatures.length} selected
                </span>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {FEATURES.map((feature) => {
                  const selected = selectedFeatures.includes(feature);
                  return (
                    <button
                      key={feature}
                      type="button"
                      onClick={() => toggleFeature(feature)}
                      className={`relative flex items-center justify-center text-center px-2 py-3 rounded-xl border text-[10.5px] font-semibold leading-tight transition-all duration-150 ${
                        selected
                          ? "bg-muted border-primary text-primary"
                          : "bg-background border-border text-muted-foreground hover:border-border hover:bg-muted"
                      }`}
                    >
                      {selected && (
                        <span className="absolute top-1.5 right-1.5 w-4 h-4 rounded-full bg-primary flex items-center justify-center">
                          <Check size={9} className="text-white" strokeWidth={3} />
                        </span>
                      )}
                      {feature}
                    </button>
                  );
                })}
              </div>
              {errors.features?.message ? (
                <p className="mt-2 text-[10.5px] font-medium text-destructive">
                  {errors.features.message}
                </p>
              ) : null}
            </div>

            <Separator className="bg-border" />

            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`${vehiclePath}/${vehicleId}`)}
                disabled={isSubmitting}
                className="flex-1 rounded-xl border-border text-muted-foreground h-10 text-[13px] font-medium hover:bg-background"
              >
                <X size={14} className="mr-2" /> Discard
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting}
                className="flex-1 rounded-xl bg-primary hover:bg-primary-hover text-white h-10 text-[13px] font-semibold shadow-[0_4px_14px_rgba(52,110,246,0.28)] disabled:cursor-not-allowed disabled:opacity-70"
              >
                <Save size={14} className="mr-2" /> {isSubmitting ? "Saving..." : "Save Changes"}
              </Button>
            </div>
              </form>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
