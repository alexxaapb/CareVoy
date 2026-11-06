import { AthenaAdapter } from '../../lib/athenaAdapter.mjs';
import { getCaller } from '../../lib/security.js';
import { requireAddon, loadEhrConfig } from '../../lib/billing.js';

// Add a new EHR here: one adapter file, one line in this table.
const ADAPTERS = {
  athenahealth: () => new AthenaAdapter(),
};

// Real patient data only comes back once an EHR connection is live.
// Sample data (made-up patients) is only returned if EHR_ALLOW_SAMPLE=true, for demos and testing.
function isLive(system) {
  if (system === 'athenahealth') return process.env.ATHENA_LIVE === 'true';
  return false;
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  // Only a logged-in facility coordinator or admin may search patients
  var caller = await getCaller(req);
  if (!caller) return res.status(401).json({ error: 'Unauthorized' });
  if (!caller.isAdmin && !caller.coordinator) return res.status(403).json({ error: 'Forbidden' });

  var firstName = req.query.firstName;
  var lastName = req.query.lastName;
  var dob = req.query.dob;

  if (!lastName || String(lastName).length > 100 || (firstName && String(firstName).length > 100)) {
    return res.status(400).json({ error: 'lastName is required' });
  }

  try {
    // Coordinators always search their own facility. Admins may name one.
    var hospitalId = caller.coordinator && caller.coordinator.hospital_id;
    if (caller.isAdmin && req.query.hospitalId) hospitalId = req.query.hospitalId;
    if (!hospitalId) return res.status(400).json({ error: 'No facility selected' });

    // Add-on check (does nothing until ENFORCE_ADDONS=true; admins always pass)
    var gate = await requireAddon(caller, 'ehr_sync');
    if (!gate.ok) {
      return res.status(402).json({ error: 'Native EHR Sync is an add-on. Add it under Integrations.', code: 'addon_required', addon: 'ehr_sync' });
    }

    var cfg = await loadEhrConfig(hospitalId);
    var make = cfg.system && ADAPTERS[cfg.system];
    if (!make) {
      return res.status(200).json({ results: [], connected: false, message: 'No EHR is connected for this facility yet.' });
    }
    if (!isLive(cfg.system) && process.env.EHR_ALLOW_SAMPLE !== 'true') {
      return res.status(200).json({ results: [], connected: false, message: 'EHR connection is being set up.' });
    }

    var adapter = make();
    var results = await adapter.searchPatients({ firstName: firstName, lastName: lastName, dob: dob, practiceId: cfg.practiceId });
    return res.status(200).json({ results: results, connected: true });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}
