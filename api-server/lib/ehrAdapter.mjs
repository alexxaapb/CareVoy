/**
 * EHR Adapter Interface
 *
 * Every EHR integration (athenahealth, Epic, Cerner, etc.) implements this
 * same shape. CareVoy's coordination logic only ever talks to this
 * interface — never to a specific EHR's API directly — so adding a new
 * EHR later means writing one new adapter file, not touching anything else.
 *
 * All methods return data already normalized to CareVoy's internal shape
 * (see the JSDoc typedefs below), regardless of which EHR it came from.
 */

/**
 * @typedef {Object} NormalizedPatient
 * @property {string} sourceSystem - e.g. 'athenahealth'
 * @property {string} sourcePatientId - the ID in that source system
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} dob - YYYY-MM-DD
 * @property {string} [phone]
 * @property {string} [addressLine1]
 * @property {string} [city]
 * @property {string} [state]
 * @property {string} [zip]
 */

/**
 * @typedef {Object} NormalizedLocation
 * @property {string} sourceSystem
 * @property {string} sourceLocationId
 * @property {string} name
 * @property {string} [addressLine1]
 * @property {string} [city]
 * @property {string} [state]
 * @property {string} [zip]
 * @property {string} [phone]
 */

/**
 * @typedef {Object} PatientSearchCriteria
 * @property {string} firstName
 * @property {string} lastName
 * @property {string} dob - YYYY-MM-DD
 * @property {string} [practiceId]
 */

/**
 * Base class every EHR adapter extends. Throws if a method isn't
 * implemented, so a half-built adapter fails loudly during development
 * instead of silently returning nothing.
 */
export class EHRAdapter {
  /**
   * @param {string} sourcePatientId
   * @param {string} [practiceId]
   * @returns {Promise<NormalizedPatient>}
   */
  async getPatient(sourcePatientId, practiceId) {
    throw new Error('getPatient() not implemented for this adapter');
  }

  /**
   * @param {PatientSearchCriteria} criteria
   * @returns {Promise<NormalizedPatient[]>}
   */
  async searchPatients(criteria) {
    throw new Error('searchPatients() not implemented for this adapter');
  }

  /**
   * @param {string} sourceLocationId
   * @param {string} [practiceId]
   * @returns {Promise<NormalizedLocation>}
   */
  async getLocation(sourceLocationId, practiceId) {
    throw new Error('getLocation() not implemented for this adapter');
  }
}