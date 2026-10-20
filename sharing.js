// Build a text-only snapshot. Application is excluded unless explicitly selected.
const QTShare = {
  text(entry, includeApplication = false) {
    const sections = [
      `날짜: ${entry.date}`,
      `말씀: ${entry.reference}`,
      `관찰\n${entry.observation}`,
      `해석\n${entry.interpretation}`
    ];
    if (includeApplication === true) sections.push(`적용\n${entry.application}`);
    return sections.join('\n\n');
  }
};
if (typeof module !== 'undefined' && module.exports) module.exports = QTShare;
