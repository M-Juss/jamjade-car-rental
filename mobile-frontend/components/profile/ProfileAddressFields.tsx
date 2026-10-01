import { useEffect, useMemo, useState } from 'react';
import type { FieldErrors } from 'react-hook-form';
import { Text, View } from 'react-native';

import { SelectWithLabel, type SelectOption } from '@/components/common/SelectWithLabel';
import { FormInput } from '@/components/ui/FormInput';
import {
  getAddressBarangays,
  getAddressCitiesMunicipalities,
  getAddressProvinces,
} from '@/services/api';
import type { CustomerAddress } from '@/types/customer';

type ProfileAddressFieldsProps = {
  value: CustomerAddress;
  onChange: (value: CustomerAddress) => void;
  errors?: FieldErrors<CustomerAddress>;
};

type DirectoryOption = {
  code: string;
  name: string;
  postalCode?: string | null;
};

const COUNTRY_OPTIONS: SelectOption[] = [{ value: 'PH', label: 'Philippines' }];
const NCR_CODE = '1300000000';

function toOptions(items: DirectoryOption[]): SelectOption[] {
  return items.map((item) => ({ value: item.code, label: item.name }));
}

function getLabel(options: SelectOption[], value?: string | null) {
  return options.find((option) => option.value === value)?.label;
}

function formatAddress(value: CustomerAddress, options: {
  provinceOptions: SelectOption[];
  cityOptions: SelectOption[];
  barangayOptions: SelectOption[];
}) {
  const provinceCode = value.provinceCode ?? (value.regionCode === NCR_CODE ? NCR_CODE : null);
  const parts = [
    value.addressLine.trim(),
    getLabel(options.barangayOptions, value.barangayCode),
    getLabel(options.cityOptions, value.cityMunicipalityCode),
    getLabel(options.provinceOptions, provinceCode),
    value.postalCode.trim(),
  ].filter(Boolean);

  return parts.join(', ');
}

export function ProfileAddressFields({ value, onChange, errors }: ProfileAddressFieldsProps) {
  const [provinceItems, setProvinceItems] = useState<DirectoryOption[]>([]);
  const [cityItems, setCityItems] = useState<DirectoryOption[]>([]);
  const [barangayItems, setBarangayItems] = useState<DirectoryOption[]>([]);
  const [loading, setLoading] = useState({
    provinces: false,
    cities: false,
    barangays: false,
  });
  const [provincesLoaded, setProvincesLoaded] = useState(false);
  const [loadedCityKey, setLoadedCityKey] = useState('');
  const [directoryError, setDirectoryError] = useState('');

  const provinceOptions = useMemo(() => toOptions(provinceItems), [provinceItems]);
  const cityOptions = useMemo(() => toOptions(cityItems), [cityItems]);
  const barangayOptions = useMemo(() => toOptions(barangayItems), [barangayItems]);
  const selectedProvinceCode = value.provinceCode ?? (value.regionCode === NCR_CODE ? NCR_CODE : '');
  const cityKey = selectedProvinceCode;
  const updateValue = (patch: Partial<CustomerAddress>) => {
    const nextValue = { ...value, ...patch };
    const nextFormattedAddress = formatAddress(nextValue, {
      provinceOptions,
      cityOptions,
      barangayOptions,
    });

    onChange({ ...nextValue, formattedAddress: nextFormattedAddress });
  };

  useEffect(() => {
    let active = true;

    setLoading((current) => ({ ...current, provinces: true }));
    setDirectoryError('');

    getAddressProvinces()
      .then((items) => {
        if (active) {
          setProvinceItems(items);
          setProvincesLoaded(true);
        }
      })
      .catch(() => {
        if (active) {
          setDirectoryError('Unable to load address locations. Please try again.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading((current) => ({ ...current, provinces: false }));
        }
      });

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (!provincesLoaded || !selectedProvinceCode) {
      return;
    }

    let active = true;
    setLoading((current) => ({ ...current, cities: true }));
    setDirectoryError('');

    getAddressCitiesMunicipalities(selectedProvinceCode)
      .then((items) => {
        if (active) {
          setCityItems(items);
          setLoadedCityKey(cityKey);
        }
      })
      .catch(() => {
        if (active) {
          setDirectoryError('Unable to load cities and municipalities. Please try again.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading((current) => ({ ...current, cities: false }));
        }
      });

    return () => {
      active = false;
    };
  }, [cityKey, provincesLoaded, selectedProvinceCode]);

  useEffect(() => {
    if (!selectedProvinceCode || !value.cityMunicipalityCode || loadedCityKey !== cityKey) {
      return;
    }

    let active = true;
    setLoading((current) => ({ ...current, barangays: true }));
    setDirectoryError('');

    getAddressBarangays(value.regionCode, selectedProvinceCode, value.cityMunicipalityCode)
      .then((items) => {
        if (active) {
          setBarangayItems(items);
        }
      })
      .catch(() => {
        if (active) {
          setDirectoryError('Unable to load barangays. Please try again.');
        }
      })
      .finally(() => {
        if (active) {
          setLoading((current) => ({ ...current, barangays: false }));
        }
      });

    return () => {
      active = false;
    };
  }, [cityKey, loadedCityKey, selectedProvinceCode, value.cityMunicipalityCode, value.regionCode]);

  return (
    <View className="gap-4">
      <SelectWithLabel
        disabled
        icon="public"
        label="Country"
        options={COUNTRY_OPTIONS}
        required
        value={value.countryCode}
      />

      <SelectWithLabel
        disabled={loading.provinces || !provincesLoaded}
        error={errors?.provinceCode?.message?.toString()}
        helperText={loading.provinces ? 'Loading provinces...' : undefined}
        icon="location-city"
        label="Province / Metro Manila"
        onValueChange={(provinceCode) => {
          updateValue({
            provinceCode: provinceCode === NCR_CODE ? null : provinceCode,
            regionCode: provinceCode === NCR_CODE ? NCR_CODE : `${provinceCode.slice(0, 2)}00000000`,
            cityMunicipalityCode: '',
            barangayCode: '',
          });
          setCityItems([]);
          setBarangayItems([]);
          setLoadedCityKey('');
        }}
        options={provinceOptions}
        placeholder="Select your province or Metro Manila"
        required
        value={selectedProvinceCode}
      />

      <SelectWithLabel
        disabled={!selectedProvinceCode || loading.cities || loadedCityKey !== cityKey}
        error={errors?.cityMunicipalityCode?.message?.toString()}
        helperText={loading.cities ? 'Loading cities and municipalities...' : undefined}
        icon="location-city"
        label="City / Municipality"
        onValueChange={(cityMunicipalityCode) => {
          updateValue({ cityMunicipalityCode, barangayCode: '' });
          setBarangayItems([]);
        }}
        options={cityOptions}
        placeholder="Select your city or municipality"
        required
        value={value.cityMunicipalityCode}
      />

      <SelectWithLabel
        disabled={!value.cityMunicipalityCode || loading.barangays}
        error={errors?.barangayCode?.message?.toString()}
        helperText={loading.barangays ? 'Loading barangays...' : undefined}
        icon="home"
        label="Barangay"
        onValueChange={(barangayCode) => {
          updateValue({ barangayCode });
        }}
        options={barangayOptions}
        placeholder="Select your barangay"
        required
        value={value.barangayCode}
      />

      <FormInput
        autoCapitalize="words"
        error={errors?.addressLine?.message?.toString()}
        icon="home"
        label="House / Unit / Lot / Block and Street"
        maxLength={255}
        onChangeText={(addressLine) => updateValue({ addressLine })}
        placeholder="e.g. 123 Main Street, Block 4 Lot 2"
        required
        value={value.addressLine}
      />

      <FormInput
        autoCapitalize="characters"
        error={errors?.postalCode?.message?.toString()}
        icon="markunread-mailbox"
        keyboardType="number-pad"
        label="Postal Code"
        maxLength={20}
        onChangeText={(postalCode) => updateValue({ postalCode })}
        placeholder="Enter postal code"
        required
        value={value.postalCode}
      />

      {directoryError ? (
        <Text className="-mt-2 text-[11px] font-bold leading-4 text-destructive">{directoryError}</Text>
      ) : null}

    </View>
  );
}
