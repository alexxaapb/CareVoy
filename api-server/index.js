module.exports = (req, res) => {
  res.status(200).json({ name: "CareVoy API", status: "ok", version: "1.0.0" });
};
