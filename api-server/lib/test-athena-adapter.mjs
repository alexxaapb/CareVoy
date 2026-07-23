import { AthenaAdapter } from './lib/athenaAdapter.mjs';

const adapter = new AthenaAdapter();

console.log('--- getPatient ---');
const patient = await adapter.getPatient('mock-patient-1');
console.log(patient);

console.log('--- searchPatients (by last name) ---');
const results = await adapter.searchPatients({ lastName: 'Thompson' });
console.log(results);

console.log('--- getLocation ---');
const location = await adapter.getLocation('mock-location-1');
console.log(location);