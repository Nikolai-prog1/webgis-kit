export function download(blob, filename) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
}
export function csvText(fields, features) {
  const cell = (value) => {
    let text = String(value ?? '');
    if (/^[=+@-]/.test(text)) text = `'${text}`;
    return `"${text.replaceAll('"', '""')}"`;
  };
  return (
    '\uFEFF' +
    [
      fields.map((field) => cell(field.label || field.name)).join(','),
      ...features.map((feature) =>
        fields.map((field) => cell(feature.get(field.name))).join(','),
      ),
    ].join('\r\n')
  );
}
