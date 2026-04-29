import { fabric } from 'fabric';
import { CANVAS_CONSTANTS } from '../constants/canvas';
import { BLOCK_THEME } from '../constants/theme';
import { wrapThaiText } from '../utils/textUtils';

/**
 * Manages the creation and linking of signature blocks on the canvas.
 * Extracted from useCanvas.js to follow Single Responsibility Principle.
 *
 * @param {import('vue').ShallowRef} canvas - The Fabric.js canvas instance ref
 * @param {object} callbacks - Callback object with lazy getters
 * @param {Function} callbacks.saveCurrentPageState - Saves page state after modification
 * @param {Function} callbacks.saveHistory - Saves undo history
 * @param {Function} callbacks.getPageScaleAtPos - Gets scale factor for a given Y position
 */
export function useSignatureBlock(canvas, callbacks = {}) {

  const linkSignatureBlocks = (canvasObj, prefixTextbox, sigGroup, GAP) => {
    if (prefixTextbox.__isLinked) return;
    prefixTextbox.__isLinked = true;
    sigGroup.__isLinked = true;

    let isSyncing = false;

    const syncPositions = (movedObj) => {
      if (isSyncing || prefixTextbox.group || sigGroup.group) return;
      const activeObj = canvasObj.getActiveObject();
      if (activeObj && activeObj.type === 'activeSelection') return;

      isSyncing = true;
      if (movedObj === prefixTextbox && sigGroup.canvas) {
        sigGroup.set({
          left: prefixTextbox.left,
          top: prefixTextbox.top + prefixTextbox.getScaledHeight() + GAP
        });
        sigGroup.setCoords();
      } else if (movedObj === sigGroup && prefixTextbox.canvas) {
        prefixTextbox.set({
          left: sigGroup.left,
          top: sigGroup.top - prefixTextbox.getScaledHeight() - GAP
        });
        prefixTextbox.setCoords();
      }
      isSyncing = false;
    };

    const originalPrefixSet = prefixTextbox.set.bind(prefixTextbox);
    prefixTextbox.set = function (...args) {
      originalPrefixSet(...args);
      if (!this.group) syncPositions(prefixTextbox);
      return this;
    };

    const originalGroupSet = sigGroup.set.bind(sigGroup);
    sigGroup.set = function (...args) {
      originalGroupSet(...args);
      if (!this.group) syncPositions(sigGroup);
      return this;
    };

    prefixTextbox.on('moving', () => syncPositions(prefixTextbox));
    prefixTextbox.on('resizing', () => syncPositions(prefixTextbox));
    prefixTextbox.on('scaling', () => syncPositions(prefixTextbox));
    sigGroup.on('moving', () => syncPositions(sigGroup));
    sigGroup.on('scaling', () => syncPositions(sigGroup));

    prefixTextbox.on('changed', () => {
      syncPositions(prefixTextbox);
      canvasObj.renderAll();
    });

    const handleDeletion = (deletedObj) => {
      if (deletedObj.isDeleting) return;
      deletedObj.isDeleting = true;
      if (deletedObj === prefixTextbox && sigGroup.canvas) {
        sigGroup.isDeleting = true;
        canvasObj.remove(sigGroup);
      } else if (deletedObj === sigGroup && prefixTextbox.canvas) {
        prefixTextbox.isDeleting = true;
        canvasObj.remove(prefixTextbox);
      }
    };

    prefixTextbox.on('removed', () => handleDeletion(prefixTextbox));
    sigGroup.on('removed', () => handleDeletion(sigGroup));
  };

  const addSignatureBlockToCanvas = (
    sigData,
    dropX = 100,
    dropY = 100,
    customPrefixText = null
  ) => {
    if (!canvas.value) return;

    const getPageScaleAtPos = callbacks.getPageScaleAtPos;
    const scale = typeof getPageScaleAtPos === 'function' ? getPageScaleAtPos(dropY) : 1;
    const maxTextWidth = BLOCK_THEME.SIGNATURE.MAX_TEXT_WIDTH * scale;
    const fontSize = BLOCK_THEME.SIGNATURE.FONT_SIZE * scale;
    const fontFamily = BLOCK_THEME.FONT_FAMILY;
    const GAP = BLOCK_THEME.SIGNATURE.GAP * scale;

    const sharedLinkedId = `link_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    const buildUnifiedSignatureGroup = (imgObj = null) => {
      const objects = [];
      let currentInternalY = 0;
      const centerX = 0;

      const balancer = new fabric.Rect({
        left: centerX,
        top: currentInternalY,
        width: BLOCK_THEME.SIGNATURE.MAX_TEXT_WIDTH * scale,
        height: BLOCK_THEME.SIGNATURE.BALANCER_HEIGHT,
        fill: 'transparent',
        originX: 'center',
        originY: 'top',
        selectable: false,
        evented: false
      });
      objects.push(balancer);

      const textToShow = customPrefixText !== null ? customPrefixText : sigData.prefixText;

      if (textToShow && textToShow.trim() !== '') {
        let prefixFontSize = fontSize;
        if (textToShow.length >= 60) {
          prefixFontSize = fontSize - 2 * scale;
        } else if (textToShow.length >= 35) {
          prefixFontSize = fontSize - 1 * scale;
        }

        const wrappedPrefix =
          typeof wrapThaiText === 'function'
            ? wrapThaiText(textToShow, maxTextWidth, prefixFontSize, fontFamily)
            : textToShow;

        const prefixTextbox = new fabric.Textbox(wrappedPrefix, {
          left: centerX,
          top: currentInternalY,
          fontSize: prefixFontSize,
          fontFamily: fontFamily,
          textAlign: 'center',
          width: maxTextWidth + BLOCK_THEME.SIGNATURE.FONT_SIZE * scale,
          originX: 'center',
          originY: 'top',
          fill: BLOCK_THEME.PRIMARY_COLOR,
          editable: false,
          selectable: false,
          evented: false
        });
        objects.push(prefixTextbox);
        currentInternalY += prefixTextbox.getScaledHeight() + GAP + BLOCK_THEME.SIGNATURE.PREFIX_GAP_EXTRA * scale;
      }

      if (imgObj) {
        imgObj.scaleToHeight(BLOCK_THEME.SIGNATURE.IMAGE_HEIGHT * scale);
        imgObj.set({
          originX: 'center',
          originY: 'top',
          top: currentInternalY,
          left: centerX,
          selectable: false,
          evented: false
        });
        objects.push(imgObj);
        currentInternalY += imgObj.getScaledHeight() + BLOCK_THEME.SIGNATURE.IMAGE_GAP * scale;
      } else {
        currentInternalY += BLOCK_THEME.SIGNATURE.IMAGE_HEIGHT * scale;
      }

      const nameText = new fabric.Text(`( ${sigData.fullName} )`, {
        fontSize: fontSize,
        fontFamily: fontFamily,
        originX: 'center',
        originY: 'top',
        top: currentInternalY,
        left: centerX,
        fill: BLOCK_THEME.PRIMARY_COLOR,
        selectable: false,
        evented: false
      });
      objects.push(nameText);
      currentInternalY += nameText.height + BLOCK_THEME.SIGNATURE.NAME_GAP * scale;

      if (sigData.position) {
        const wrappedPos =
          typeof wrapThaiText === 'function'
            ? wrapThaiText(sigData.position, maxTextWidth, fontSize, fontFamily)
            : sigData.position;

        const bottomText = new fabric.Text(wrappedPos, {
          fontSize: fontSize,
          fontFamily: fontFamily,
          originX: 'center',
          originY: 'top',
          textAlign: 'center',
          top: currentInternalY,
          left: centerX,
          fill: BLOCK_THEME.PRIMARY_COLOR,
          selectable: false,
          evented: false
        });
        objects.push(bottomText);
      }

      const unifiedGroup = new fabric.Group(objects, {
        left: dropX,
        top: dropY,
        originX: 'center',
        originY: 'top',
        isSignatureBlock: true,
        sigData: sigData,
        id: `signature_${sharedLinkedId}`,
        name: `ลายเซ็น: ${sigData.fullName}`,
        subTargetCheck: false
      });

      canvas.value.add(unifiedGroup);
      canvas.value.setActiveObject(unifiedGroup);
      canvas.value.requestRenderAll();

      if (typeof callbacks.saveCurrentPageState === 'function') callbacks.saveCurrentPageState();
      if (typeof callbacks.saveHistory === 'function') callbacks.saveHistory();
    };

    if (sigData.signatureImage) {
      let imageUrl = sigData.signatureImage;
      if (imageUrl.includes('uploads/')) {
        const backendPort = import.meta.env.VITE_API_PORT || '4011';
        const protocol = window.location.protocol;
        const hostname = window.location.hostname;
        if (!imageUrl.startsWith('/')) imageUrl = '/' + imageUrl;
        imageUrl = `${protocol}//${hostname}:${backendPort}${imageUrl}`;
      }

      fabric.Image.fromURL(
        imageUrl,
        (img, isError) => {
          if (!isError && img) buildUnifiedSignatureGroup(img);
          else buildUnifiedSignatureGroup();
        },
        { crossOrigin: 'anonymous' }
      );
    } else {
      buildUnifiedSignatureGroup();
    }
  };

  const relinkSignatures = () => {
    if (!canvas.value) return;
    const objects = canvas.value.getObjects();
    const pairs = {};

    objects.forEach((obj) => {
      if (obj.linkedId) {
        if (!pairs[obj.linkedId]) pairs[obj.linkedId] = {};
        if (obj.isSignaturePrefix) pairs[obj.linkedId].prefix = obj;
        if (obj.isSignatureBlock) pairs[obj.linkedId].group = obj;
      }
    });

    Object.values(pairs).forEach((pair) => {
      if (pair.prefix && pair.group) {
        const GAP = pair.group.sigData?.signatureImage ? 3 : 3;
        linkSignatureBlocks(canvas.value, pair.prefix, pair.group, GAP);
      }
    });
  };

  return {
    addSignatureBlockToCanvas,
    relinkSignatures,
    linkSignatureBlocks
  };
}
