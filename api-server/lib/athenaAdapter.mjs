import { EHRAdapter } from './ehrAdapter.mjs';
import { getAthenaAccessToken } from './athenaAuth.mjs';

const FHIR_BASE_URL = 'https://api.preview.platform.athenahealth.com/fhir/r4';

// -------------------------------------------------------------------------
// MOCK DATA — shaped exactly like athenahealth's real FHIR R4 responses
// (US Core Patient / Location profiles). Replace the functions below with
// real fetch() calls once a practice grants this app access — the shape
// won't change, only where the data comes from.
// -------------------------------------------------------------------------

const MOCK_PATIENTS = [
  {
    resourceType: 'Patient',
    id: 'mock-patient-1',
    identifier: [{ system: 'https://mock.athenahealth.com/patientid', value: '12345' }],
    name: [{ family: 'Rivera', given: ['Maria'] }],
    birthDate: '1958-04-12',
    telecom: [{ system: 'phone', value: '555-201-4477' }],
    address: [{ line: ['482 Cedar Ave'], city: 'Columbus', state: 'OH', postalCode: '43215' }],
  },
  {
    resourceType: 'Patient',
    id: 'mock-patient-2',
    identifier: [{ system: 'https://mock.athenahealth.com/patientid', value: '67890' }],
    name: [{ family: 'Thompson', given: ['James'] }],
    birthDate: '1971-11-03',
    telecom: [{ system: 'phone', value: '555-330-9821' }],
    address: [{ line: ['119 Maple St'], city: 'Columbus', state: 'OH', postalCode: '43206' }],
  },
];

const MOCK_LOCATIONS = [
  {
    resourceType: 'Location',
    id: 'mock-location-1',
    name: 'Columbus Family Medicine - Main Campus',
    telecom: [{ system: 'phone', value: '555-400-1000' }],
    address: { line: ['700 Health Plaza'], city: 'Columbus', state: 'OH', postalCode: '43215' },
  },
];

// -------------------------------------------------------------------------
// Normalizers — convert raw FHIR resource JSON into CareVoy's internal shape
// -------------------------------------------------------------------------

function normalizePatient(fhirPatient) {
  const name = fhirPatient.name?.[0] || {};
  const address = fhirPatient.address?.[0] || {};
  const phone = fhirPatient.telecom?.find((t) => t.system === 'phone')?.value;

  return {
    sourceSystem: 'athenahealth',
    sourcePatientId: fhirPatient.id,
    firstName: name.given?.[0] || '',
    lastName: name.family || '',
    dob: fhirPatient.birthDate,
    phone,
    addressLine1: address.line?.[0],
    city: address.city,
    state: address.state,
    zip: address.postalCode,
  };
}

function normalizeLocation(fhirLocation) {
  const address = fhirLocation.address || {};
  const phone = fhirLocation.telecom?.find((t) => t.system === 'phone')?.value;

  return {
    sourceSystem: 'athenahealth',
    sourceLocationId: fhirLocation.id,
    name: fhirLocation.name,
    addressLine1: address.line?.[0],
    city: address.city,
    state: address.state,
    zip: address.postalCode,
    phone,
  };
}

// -------------------------------------------------------------------------
// Adapter
// -------------------------------------------------------------------------

export class AthenaAdapter extends EHRAdapter {
  async getPatient(sourcePatientId, practiceId) {
    // TODO once practice access is granted, replace with:
    // const token = await getAthenaAccessToken();
    // const response = await fetch(`${FHIR_BASE_URL}/Patient/${sourcePatientId}`, {
    //   headers: { Authorization: `Bearer ${token}` },
    // });
    // const fhirPatient = await response.json();

    const fhirPatient = MOCK_PATIENTS.find((p) => p.id === sourcePatientId);
    if (!fhirPatient) {
      throw new Error(`Patient not found: ${sourcePatientId}`);
    }
    return normalizePatient(fhirPatient);
  }

  async searchPatients({ firstName, lastName, dob }) {
    // TODO once practice access is granted, replace with a real FHIR search:
    // GET ${FHIR_BASE_URL}/Patient?family=${lastName}&given=${firstName}&birthdate=${dob}

    const matches = MOCK_PATIENTS.filter((p) => {
      const name = p.name?.[0] || {};
      const familyMatch = !lastName || name.family?.toLowerCase() === lastName.toLowerCase();
      const givenMatch = !firstName || name.given?.[0]?.toLowerCase() === firstName.toLowerCase();
      const dobMatch = !dob || p.birthDate === dob;
      return familyMatch && givenMatch && dobMatch;
    });

    return matches.map(normalizePatient);
  }

  async getLocation(sourceLocationId, practiceId) {
    // TODO once practice access is granted, replace with:
    // const token = await getAthenaAccessToken();
    // const response = await fetch(`${FHIR_BASE_URL}/Location/${sourceLocationId}`, {
    //   headers: { Authorization: `Bearer ${token}` },
    // });

    const fhirLocation = MOCK_LOCATIONS.find((l) => l.id === sourceLocationId);
    if (!fhirLocation) {
      throw new Error(`Location not found: ${sourceLocationId}`);
    }
    return normalizeLocation(fhirLocation);
  }
}