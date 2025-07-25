// Utility function to remove duplicates by name and address
export default function removeDuplicates(data) {
  const seen = new Set();
  return data.filter((item) => {
    const key = `${item.name}|${item.address}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}
