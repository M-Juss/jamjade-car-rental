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
import { VehicleFeatureSelector } from "@/modules/management/vehicles/components/VehicleFeatureSelector";
import { getVehicle, updateVehicle } from "@/services/vehicle";
import { ApiError } from "@/services/http";
import { useVehicleOptions, vehicleSelectOptions } from "@/modules/management/vehicles/use-vehicle-options";
import { appToast } from "@/lib/toast";
import {
  editVehicleFormSchema,
  type EditVehicleFormValues,
} from "@/validations/vehicle/schemas";
import { managementPath } from "@/modules/management/shell/config/module-registry";
import { useManagementPortal } from "@/modules/management/shell/context/ManagementSessionProvider";


interface EditVehicleFormProps {
  vehicleId: string;
}

export default function EditVehicleForm({ vehicleId }: EditVehicleFormProps) {
  const router = useRouter();
  const { data: configuration, error: configurationError, reload: reloadConfiguration } = useVehicleOptions();
  const portal = useManagementPortal();
  const vehiclePath = managementPath(portal, "vehicles") ?? "/owner/vehicle";
  const [savedOptions, setSavedOptions] = useState({ brand: "", transmission: "", fuel_type: "", features: [] as string[] });
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
          setSavedOptions({ brand: vehicle.brand, transmission: vehicle.transmission, fuel_type: vehicle.fuelType, features: vehicle.features });
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

  const onSubmit = async (values: EditVehicleFormValues) => {
    try {
      await updateVehicle(vehicleId, values);
      appToast.success("Vehicle updated successfully.");
      router.push(`${vehiclePath}/${vehicleId}`);
    } catch (saveError) {
      if (saveError instanceof ApiError && saveError.errors) {
        Object.entries(saveError.errors).forEach(([serverField, messages]) => {
          const field = serverField.startsWith("features.") ? "features" : serverField;
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
      {configurationError ? <div role="alert" className="flex items-center justify-between gap-3 text-sm text-destructive">{configurationError}<Button type="button" variant="outline" onClick={reloadConfiguration}>Retry</Button></div> : !configuration ? <p role="status" className="text-sm text-muted-foreground">Loading options...</p> : null}
      <div className="flex items-center gap-2">
        <button
          onClick={() => router.push(vehiclePath)}
          className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-primary transition-colors duration-150 group"
        >
          <ChevronLeft
            size={15}
            className="group-hover:-translate-x-0.5 transition-transform duration-150"
          />
          Vehicle Management
        </button>
        <span className="text-border text-sm">/</span>
        <span className="text-sm font-semibold text-foreground">
          {vehicleName || "Vehicle"}
        </span>
      </div>

      <div>
        <Card className="rounded-2xl border border-border shadow-none bg-surface overflow-hidden">
          <CardHeader className="flex flex-col items-stretch justify-between gap-3 border-b border-border px-5 pb-3 pt-5 sm:flex-row sm:items-center">
            <CardTitle className="flex items-center gap-2 text-base font-semibold text-foreground">
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
              <div className="rounded-2xl border border-dashed border-border p-8 text-center text-sm font-medium text-muted-foreground">
                Loading vehicle...
              </div>
            ) : error ? (
              <div className="rounded-2xl border border-destructive-border bg-destructive-surface p-8 text-center text-sm font-medium text-destructive">
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
                <div className="flex shrink-0 items-center justify-center text-primary">
                  <ImageIcon size={12} className="text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Image Gallery</h3>
              </div>

              {images.length > 0 ? (
                <VehicleImageGallery images={images} alt={form.name ?? "Vehicle"} />
              ) : (
                <div className="rounded-2xl border border-dashed border-border p-6 text-center text-sm font-medium text-muted-foreground">
                  No images uploaded.
                </div>
              )}
            </div>

            <Separator className="bg-border" />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex shrink-0 items-center justify-center text-primary">
                  <Car size={12} className="text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Basic Information</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputWithLabel
                  id="edit-vehicle-name"
                  label="Vehicle Name"
                  error={errors.name?.message}
                  {...register("name")}
                  wrapperClassName="sm:col-span-2"
                  labelClassName="text-xs font-semibold tracking-normal normal-case text-muted-foreground"
                />

                <div>
                  <SelectWithLabel
                    id="edit-vehicle-brand"
                    label="Brand"
                    placeholder="Select brand"
                    options={vehicleSelectOptions([...(configuration?.options.brand ?? []), savedOptions.brand], form.brand)}
                    value={form.brand ?? ""}
                    error={errors.brand?.message}
                    onValueChange={(value) => {
                      setValue("brand", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    labelClassName="text-xs font-semibold tracking-normal normal-case text-muted-foreground"
                    triggerClassName="text-base sm:text-sm rounded-xl border-border bg-background"
                  />
                </div>

                <InputWithLabel
                  id="edit-vehicle-model"
                  label="Model"
                  error={errors.model?.message}
                  {...register("model")}
                  labelClassName="text-xs font-semibold tracking-normal normal-case text-muted-foreground"
                />

                <InputWithLabel
                  id="edit-vehicle-plate-number"
                  label="Plate Number"
                  error={errors.plate_number?.message}
                  placeholder="e.g. ABC 1234"
                  {...register("plate_number")}
                  labelClassName="text-xs font-semibold tracking-normal normal-case text-muted-foreground"
                />

                <InputWithLabel
                  id="edit-vehicle-price"
                  label="Price / Day (₱)"
                  icon={<PhilippinePeso size={13} />}
                  type="number"
                  error={errors.price_per_day?.message}
                  {...register("price_per_day")}
                  labelClassName="text-xs font-semibold tracking-normal normal-case text-muted-foreground"
                />

                <TextAreaWithLabel
                  id="edit-vehicle-description"
                  label="Description"
                  error={errors.description?.message}
                  {...register("description")}
                  wrapperClassName="sm:col-span-2"
                  rows={3}
                  labelClassName="text-xs font-semibold tracking-normal normal-case text-muted-foreground"
                  textareaClassName="min-h-[92px]"
                />
              </div>
            </div>

            <Separator className="bg-border" />

            <div>
              <div className="flex items-center gap-2 mb-3">
                <div className="flex shrink-0 items-center justify-center text-primary">
                  <Settings2 size={12} className="text-primary" />
                </div>
                <h3 className="text-sm font-semibold text-foreground">Specifications</h3>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <InputWithLabel
                  id="edit-vehicle-seats"
                  label="Seats"
                  icon={<Users size={13} />}
                  type="number"
                  error={errors.seats?.message}
                  {...register("seats")}
                  labelClassName="text-xs font-semibold tracking-normal normal-case text-muted-foreground"
                />

                <InputWithLabel
                  id="edit-vehicle-color"
                  label="Color"
                  error={errors.color?.message}
                  {...register("color")}
                  labelClassName="text-xs font-semibold tracking-normal normal-case text-muted-foreground"
                />

                <div>
                  <SelectWithLabel
                    id="edit-vehicle-transmission"
                    label="Transmission"
                    placeholder="Select"
                    options={vehicleSelectOptions([...(configuration?.options.transmission ?? []), savedOptions.transmission], form.transmission)}
                    value={form.transmission ?? ""}
                    error={errors.transmission?.message}
                    onValueChange={(value) => {
                      setValue("transmission", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    labelClassName="text-xs font-semibold tracking-normal normal-case text-muted-foreground"
                    triggerClassName="text-base sm:text-sm rounded-xl border-border bg-background"
                  />
                </div>

                <div>
                  <SelectWithLabel
                    id="edit-vehicle-fuel"
                    label="Fuel Type"
                    placeholder="Select"
                    options={vehicleSelectOptions([...(configuration?.options.fuel_type ?? []), savedOptions.fuel_type], form.fuel_type)}
                    value={form.fuel_type ?? ""}
                    error={errors.fuel_type?.message}
                    onValueChange={(value) => {
                      setValue("fuel_type", value, {
                        shouldDirty: true,
                        shouldValidate: true,
                      });
                    }}
                    labelClassName="text-xs font-semibold tracking-normal normal-case text-muted-foreground"
                    triggerClassName="text-base sm:text-sm rounded-xl border-border bg-background"
                  />
                </div>
              </div>
            </div>

            <Separator className="bg-border" />

            <VehicleFeatureSelector
              key={vehicleId}
              value={selectedFeatures}
                    options={[...(configuration?.options.feature ?? []), ...savedOptions.features]}
              disabled={isSubmitting || !configuration}
              error={errors.features?.message}
              onChange={(features) => setValue("features", features, {
                shouldDirty: true,
                shouldTouch: true,
                shouldValidate: true,
              })}
            />

            <Separator className="bg-border" />

            <div className="flex flex-col-reverse sm:flex-row gap-2.5">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push(`${vehiclePath}/${vehicleId}`)}
                disabled={isSubmitting || !configuration}
                className="flex-1 rounded-xl border-border text-muted-foreground h-10 text-sm font-medium hover:bg-background"
              >
                <X size={14} className="mr-2" /> Discard
              </Button>
              <Button
                type="submit"
                disabled={isSubmitting || !configuration}
                className="flex-1 rounded-xl bg-primary hover:bg-primary-hover text-primary-foreground h-10 text-sm font-semibold shadow-none disabled:cursor-not-allowed disabled:opacity-70"
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
