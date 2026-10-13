import { AthenaAdapter } from '../../lib/athenaAdapter.mjs';
import { getCaller } from '../../lib/security.js';

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
    var adapter = new AthenaAdapter();
    var results = await adapter.searchPatients({ firstName: firstName, lastName: lastName, dob: dob });
    return res.status(200).json({ results: results });
  } catch (err) {
    return res.status(500).json({ error: err.message });
  }
}