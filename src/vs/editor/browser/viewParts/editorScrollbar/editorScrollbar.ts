/*---------------------------------------------------------------------------------------------
 *  Copyright (c) Microsoft Corporation. All rights reserved.
 *  Licensed under the MIT License. See License.txt in the project root for license information.
 *--------------------------------------------------------------------------------------------*/

import * as dom from 'vs/base/browser/dom';
import { FastDomNode, createFastDomNode } from 'vs/base/browser/fastDomNode';
import { IMouseEvent } from 'vs/base/browser/mouseEvent';
import { IOverviewRulerLayoutInfo, SmoothScrollableElement } from 'vs/base/browser/ui/scrollbar/scrollableElement';
import { ScrollableElementChangeOptions, ScrollableElementCreationOptions } from 'vs/base/browser/ui/scrollbar/scrollableElementOptions';
import { PartFingerprint, PartFingerprints, ViewPart } from 'vs/editor/browser/view/viewPart';
import { INewScrollPosition, ScrollType } from 'vs/editor/common/editorCommon';
import { RenderingContext, RestrictedRenderingContext } from 'vs/editor/browser/view/renderingContext';
import { ViewContext } from 'vs/editor/common/viewContext';
import * as viewEvents from 'vs/editor/common/viewEvents';
import { registerThemingParticipant, getThemeTypeSelector } from 'vs/platform/theme/common/themeService';
import { EditorOption } from 'vs/editor/common/config/editorOptions';
import { scrollbarShadow, scrollbarSliderActiveBackground, scrollbarSliderBackground, scrollbarSliderHoverBackground } from 'vs/platform/theme/common/colorRegistry';

export class EditorScrollbar extends ViewPart {

	private readonly scrollbar: SmoothScrollableElement;
	private readonly scrollbarDomNode: FastDomNode<HTMLElement>;

	constructor(
		context: ViewContext,
		linesContent: FastDomNode<HTMLElement>,
		viewDomNode: FastDomNode<HTMLElement>,
		overflowGuardDomNode: FastDomNode<HTMLElement>
	) {
		super(context);


		const options = this._context.configuration.options;
		const scrollbar = options.get(EditorOption.scrollbar);
		const mouseWheelScrollSensitivity = options.get(EditorOption.mouseWheelScrollSensitivity);
		const fastScrollSensitivity = options.get(EditorOption.fastScrollSensitivity);
		const scrollPredominantAxis = options.get(EditorOption.scrollPredominantAxis);

		const scrollbarOptions: ScrollableElementCreationOptions = {
			listenOnDomNode: viewDomNode.domNode,
			className: 'editor-scrollable' + ' ' + getThemeTypeSelector(context.theme.type),
			useShadows: false,
			lazyRender: true,

			vertical: scrollbar.vertical,
			horizontal: scrollbar.horizontal,
			verticalHasArrows: scrollbar.verticalHasArrows,
			horizontalHasArrows: scrollbar.horizontalHasArrows,
			verticalScrollbarSize: scrollbar.verticalScrollbarSize,
			verticalSliderSize: scrollbar.verticalSliderSize,
			horizontalScrollbarSize: scrollbar.horizontalScrollbarSize,
			horizontalSliderSize: scrollbar.horizontalSliderSize,
			handleMouseWheel: scrollbar.handleMouseWheel,
			alwaysConsumeMouseWheel: scrollbar.alwaysConsumeMouseWheel,
			arrowSize: scrollbar.arrowSize,
			mouseWheelScrollSensitivity: mouseWheelScrollSensitivity,
			fastScrollSensitivity: fastScrollSensitivity,
			scrollPredominantAxis: scrollPredominantAxis,
			scrollByPage: scrollbar.scrollByPage,
		};

		this.scrollbar = this._register(new SmoothScrollableElement(linesContent.domNode, scrollbarOptions, this._context.viewLayout.getScrollable()));
		PartFingerprints.write(this.scrollbar.getDomNode(), PartFingerprint.ScrollableElement);

		this.scrollbarDomNode = createFastDomNode(this.scrollbar.getDomNode());
		this.scrollbarDomNode.setPosition('absolute');
		this._setLayout();

		// When having a zone widget that calls .focus() on one of its dom elements,
		// the browser will try desperately to reveal that dom node, unexpectedly
		// changing the .scrollTop of this.linesContent

		const onBrowserDesperateReveal = (domNode: HTMLElement, lookAtScrollTop: boolean, lookAtScrollLeft: boolean) => {
			const newScrollPosition: INewScrollPosition = {};

			if (lookAtScrollTop) {
				const deltaTop = domNode.scrollTop;
				if (deltaTop) {
					newScrollPosition.scrollTop = this._context.viewLayout.getCurrentScrollTop() + deltaTop;
					domNode.scrollTop = 0;
				}
			}

			if (lookAtScrollLeft) {
				const deltaLeft = domNode.scrollLeft;
				if (deltaLeft) {
					newScrollPosition.scrollLeft = this._context.viewLayout.getCurrentScrollLeft() + deltaLeft;
					domNode.scrollLeft = 0;
				}
			}

			this._context.model.setScrollPosition(newScrollPosition, ScrollType.Immediate);
		};

		// I've seen this happen both on the view dom node & on the lines content dom node.
		this._register(dom.addDisposableListener(viewDomNode.domNode, 'scroll', (e: Event) => onBrowserDesperateReveal(viewDomNode.domNode, true, true)));
		this._register(dom.addDisposableListener(linesContent.domNode, 'scroll', (e: Event) => onBrowserDesperateReveal(linesContent.domNode, true, false)));
		this._register(dom.addDisposableListener(overflowGuardDomNode.domNode, 'scroll', (e: Event) => onBrowserDesperateReveal(overflowGuardDomNode.domNode, true, false)));
		this._register(dom.addDisposableListener(this.scrollbarDomNode.domNode, 'scroll', (e: Event) => onBrowserDesperateReveal(this.scrollbarDomNode.domNode, true, false)));
	}

	public override dispose(): void {
		super.dispose();
	}

	private _setLayout(): void {
		const options = this._context.configuration.options;
		const layoutInfo = options.get(EditorOption.layoutInfo);

		this.scrollbarDomNode.setLeft(layoutInfo.contentLeft);

		const minimap = options.get(EditorOption.minimap);
		const side = minimap.side;
		if (side === 'right') {
			this.scrollbarDomNode.setWidth(layoutInfo.contentWidth + layoutInfo.minimap.minimapWidth);
		} else {
			this.scrollbarDomNode.setWidth(layoutInfo.contentWidth);
		}
		this.scrollbarDomNode.setHeight(layoutInfo.height);
	}

	public getOverviewRulerLayoutInfo(): IOverviewRulerLayoutInfo {
		return this.scrollbar.getOverviewRulerLayoutInfo();
	}

	public getDomNode(): FastDomNode<HTMLElement> {
		return this.scrollbarDomNode;
	}

	public delegateVerticalScrollbarMouseDown(browserEvent: IMouseEvent): void {
		this.scrollbar.delegateVerticalScrollbarMouseDown(browserEvent);
	}

	// --- begin event handlers

	public override onConfigurationChanged(e: viewEvents.ViewConfigurationChangedEvent): boolean {
		if (
			e.hasChanged(EditorOption.scrollbar)
			|| e.hasChanged(EditorOption.mouseWheelScrollSensitivity)
			|| e.hasChanged(EditorOption.fastScrollSensitivity)
		) {
			const options = this._context.configuration.options;
			const scrollbar = options.get(EditorOption.scrollbar);
			const mouseWheelScrollSensitivity = options.get(EditorOption.mouseWheelScrollSensitivity);
			const fastScrollSensitivity = options.get(EditorOption.fastScrollSensitivity);
			const scrollPredominantAxis = options.get(EditorOption.scrollPredominantAxis);
			const newOpts: ScrollableElementChangeOptions = {
				vertical: scrollbar.vertical,
				horizontal: scrollbar.horizontal,
				verticalScrollbarSize: scrollbar.verticalScrollbarSize,
				horizontalScrollbarSize: scrollbar.horizontalScrollbarSize,
				scrollByPage: scrollbar.scrollByPage,
				handleMouseWheel: scrollbar.handleMouseWheel,
				mouseWheelScrollSensitivity: mouseWheelScrollSensitivity,
				fastScrollSensitivity: fastScrollSensitivity,
				scrollPredominantAxis: scrollPredominantAxis
			};
			this.scrollbar.updateOptions(newOpts);
		}
		if (e.hasChanged(EditorOption.layoutInfo)) {
			this._setLayout();
		}
		return true;
	}
	public override onScrollChanged(e: viewEvents.ViewScrollChangedEvent): boolean {
		return true;
	}
	public override onThemeChanged(e: viewEvents.ViewThemeChangedEvent): boolean {
		this.scrollbar.updateClassName('editor-scrollable' + ' ' + getThemeTypeSelector(this._context.theme.type));
		return true;
	}

	// --- end event handlers

	public prepareRender(ctx: RenderingContext): void {
		// Nothing to do
	}

	public render(ctx: RestrictedRenderingContext): void {
		this.scrollbar.renderNow();
	}
}

registerThemingParticipant((theme, collector) => {

	// Scrollbars
	const scrollbarShadowColor = theme.getColor(scrollbarShadow);
	if (scrollbarShadowColor) {
		collector.addRule(`
			.monaco-scrollable-element > .shadow.top {
				box-shadow: ${scrollbarShadowColor} 0 6px 6px -6px inset;
			}

			.monaco-scrollable-element > .shadow.left {
				box-shadow: ${scrollbarShadowColor} 6px 0 6px -6px inset;
			}

			.monaco-scrollable-element > .shadow.top.left {
				box-shadow: ${scrollbarShadowColor} 6px 6px 6px -6px inset;
			}
		`);
	}

	const scrollbarSliderBackgroundColor = theme.getColor(scrollbarSliderBackground);
	if (scrollbarSliderBackgroundColor) {
		collector.addRule(`
			.monaco-scrollable-element > .scrollbar > .slider {
				background: ${scrollbarSliderBackgroundColor};
			}
		`);
	}

	const scrollbarSliderHoverBackgroundColor = theme.getColor(scrollbarSliderHoverBackground);
	if (scrollbarSliderHoverBackgroundColor) {
		collector.addRule(`
			.monaco-scrollable-element > .scrollbar > .slider:hover {
				background: ${scrollbarSliderHoverBackgroundColor};
			}
		`);
	}

	const scrollbarSliderActiveBackgroundColor = theme.getColor(scrollbarSliderActiveBackground);
	if (scrollbarSliderActiveBackgroundColor) {
		collector.addRule(`
			.monaco-scrollable-element > .scrollbar > .slider.active {
				background: ${scrollbarSliderActiveBackgroundColor};
			}
		`);
	}
});
