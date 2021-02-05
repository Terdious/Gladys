import get from 'get-value';

const getDeviceFeatureName = (dictionnary, device, deviceFeature) => {
  const featureDescription = get(dictionnary, `deviceFeatureCategory.${deviceFeature.category}.${deviceFeature.type}`);
  if (deviceFeature.name.indexOf(device.name) !== -1) {
    return `${deviceFeature.name} (${featureDescription})`;
  }
  return `${device.name} - ${deviceFeature.name} (${featureDescription})`;
};

export { getDeviceFeatureName };
