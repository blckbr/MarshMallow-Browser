export function computeContentBounds({ windowWidth, windowHeight, shell = true, sidebarWidth = 0, toolbarHeight = 0, dock = { mode:'none', width:0 } }) {
  const safeWidth = Math.max(0, Math.floor(Number(windowWidth) || 0));
  const safeHeight = Math.max(0, Math.floor(Number(windowHeight) || 0));
  if (!shell) return { page:{x:0,y:0,width:safeWidth,height:safeHeight}, dock:null };
  const x = Math.max(0, Math.floor(Number(sidebarWidth) || 0));
  const y = Math.max(0, Math.floor(Number(toolbarHeight) || 0));
  const contentWidth = Math.max(0, safeWidth - x);
  const contentHeight = Math.max(0, safeHeight - y);
  const wantsDock = dock && dock.mode && dock.mode !== 'none';
  const requested = wantsDock ? Math.max(0, Math.floor(Number(dock.width) || 0)) : 0;
  const dockWidth = Math.min(requested, Math.max(0, contentWidth - 320));
  const page = { x, y, width:Math.max(0, contentWidth - dockWidth), height:contentHeight };
  return { page, dock:dockWidth ? { x:x + page.width, y, width:dockWidth, height:contentHeight } : null };
}
