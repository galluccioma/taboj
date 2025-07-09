function getStatusColor(field: string, value: any) {
  switch (field) {
    case 'Status HTTP':
      return value !== '200' ? 'text-red-500' : '';
    case 'Status SSL':
      return value !== 'VALID' ? 'text-red-500' : '';
    case 'Keywords':
      return value === 'NO KEYWORDS' ? 'text-red-500' : '';
    case 'CMS rilevato':
      return value === 'WordPress' || value === 'PrestaShop' ? 'text-green-600' : 'text-red-500';
    case 'Strumenti analitici':
      return value && value !== 'NESSUNO' ? 'text-green-600' : 'text-red-500';
    case 'Cookie banner':
      return value && value !== 'NESSUNO' ? 'text-green-600' : 'text-red-500';
    case 'null':
      return value && value !== 'NESSUNO' && value !== 'null' ? '' : 'text-red-500';
    default:
      return '';
  }
}

export default getStatusColor;
