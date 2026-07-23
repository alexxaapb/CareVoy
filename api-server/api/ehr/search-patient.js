import { AthenaAdapter } from '../../lib/athenaAdapter.mjs';

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  var firstName = req.query.firstName;
  var lastName = req.query.lastName;
  var dob = req.query.dob;

  if (!lastName) {
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