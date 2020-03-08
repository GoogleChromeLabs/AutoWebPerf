const Frequency = {
  NONE: 'None',
  HOURLY: 'Hourly', // TODO: Hourly is for development testing.
  DAILY: 'Daily',
  WEEKLY: 'Weekly',
  BIWEEKLY: 'Bi-weekly',
  MONTHLY: 'Monthly',
};

// TODO: May need to use MomemtJS for more accurate date offset.
const FrequencyInMinutes = {
  HOURLY: 60 * 60 * 1000, // TODO: Hourly is for development testing.
  DAILY: 24 * 60 * 60 * 1000,
  WEEKLY: 7 * 24 * 60 * 60 * 1000,
  BIWEEKLY: 14 * 24 * 60 * 60 * 1000,
  MONTHLY: 30 * 24 * 60 * 60 * 1000,
};

module.exports = {
  Frequency: Frequency,
  FrequencyInMinutes: FrequencyInMinutes,
};
