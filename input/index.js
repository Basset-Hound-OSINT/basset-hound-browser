/**
 * Basset Hound Browser - Input Simulation Module
 *
 * This module provides advanced keyboard and mouse simulation
 * with human-like behavior for bot detection evasion.
 */

const keyboard = require('./keyboard');
const mouse = require('./mouse');

module.exports = {
  keyboard,
  mouse,

  // Re-export commonly used functions for convenience

  // Keyboard
  KEY_CODES: keyboard.KEY_CODES,
  KEYBOARD_LAYOUTS: keyboard.KEYBOARD_LAYOUTS,
  getKeyInfo: keyboard.getKeyInfo,
  getFullKeyPressScript: keyboard.getFullKeyPressScript,
  getKeyCombinationScript: keyboard.getKeyCombinationScript,
  getTypeTextScript: keyboard.getTypeTextScript,
  getSpecialKeyScript: keyboard.getSpecialKeyScript,
  estimateTypingDuration: keyboard.estimateTypingDuration,

  // Mouse
  MOUSE_BUTTONS: mouse.MOUSE_BUTTONS,
  generateHumanMousePath: mouse.generateHumanMousePath,
  getMouseMoveScript: mouse.getMouseMoveScript,
  getMouseClickScript: mouse.getMouseClickScript,
  getMouseDoubleClickScript: mouse.getMouseDoubleClickScript,
  getMouseRightClickScript: mouse.getMouseRightClickScript,
  getMouseDragScript: mouse.getMouseDragScript,
  getMouseHoverScript: mouse.getMouseHoverScript,
  getMouseScrollScript: mouse.getMouseScrollScript,
  getMouseWheelScript: mouse.getMouseWheelScript,
  getClickElementScript: mouse.getClickElementScript,
  getMousePositionTrackingScript: mouse.getMousePositionTrackingScript
};
