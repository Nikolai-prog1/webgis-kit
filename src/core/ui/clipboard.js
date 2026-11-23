export async function copyText(text) {
  if (navigator.clipboard?.writeText)
    return navigator.clipboard.writeText(String(text));
  const node = document.createElement('textarea');
  node.value = String(text);
  document.body.append(node);
  node.select();
  document.execCommand('copy');
  node.remove();
}
