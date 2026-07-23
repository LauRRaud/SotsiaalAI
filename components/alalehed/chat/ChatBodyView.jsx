import InviteModal from "@/components/invite/InviteModal";
import ProfiilBody from "@/components/alalehed/ProfiilBody";
import ChatAnalysisPanel from "./ChatAnalysisPanel";
import ChatComposer from "./ChatComposer";
import ConversationView from "./ConversationView";
import ChatSourcesPanel from "./ChatSourcesPanel";
import WorkspacePanel from "@/components/chat/WorkspacePanel";
import RoleViewSwitcher from "@/components/workspace/RoleViewSwitcher";
import { ChatRecordingNotice, ChatTopNotices } from "./view/ChatNotices";
import ChatMobileTopNav from "./view/ChatMobileTopNav";

export default function ChatBodyView({
  embedded,
  t,
  locale,
  profileOpen,
  closeProfile,
  workspaceOpen,
  workspaceSurfaceReady,
  onWorkspaceToggle,
  onWorkspaceClose,
  isEntering: _isEntering,
  focusActive,
  chatContainerRef,
  chatContainerClassName,
  chatRingStyle,
  handleBackHome,
  mobileRailVisible: _mobileRailVisible,
  mobileRailInteractionLocked,
  isLightTheme,
  roomId,
  inputFocused,
  isMobile,
  sourcesButtonRef,
  toggleSourcesPanel,
  showSourcesPanel,
  sourcesPulse,
  conversationSources,
  latestAnswerSources,
  allConversationSources,
  scopedSources,
  hasConversationSources,
  hasAllConversationSources: _hasAllConversationSources,
  rightRailActiveKey,
  toggleProfile,
  openProfileDirect,
  analysis,
  isRoomMode,
  roomTitle,
  roomOrigin,
  hideRoomTitle,
  allowAssistantForward,
  isHelpMatchRoom,
  isCrisis,
  crisisText,
  errorBanner,
  roomBlocked,
  roomAuthRequired,
  roomCallNode,
  roomSummaryApprovalNode,
  chatWindowRef,
  isStreamingAny,
  hiddenCount,
  pageSize,
  onRevealOlder,
  canHideOlder,
  onHideOlder,
  onJumpToBottom,
  messageItems,
  listingsPanelNode,
  workspaceListingsPanelNode,
  workspaceListingsPanelMeta,
  onWorkspaceListingsPanelBack,
  selectedListingContextNode,
  onWindowDoubleClick,
  chatAnalysisPanelProps,
  inputRowRef,
  inputBarRef,
  inputRef,
  onFocusComposer,
  onBlurInput,
  isGenerating,
  userRole,
  userActualRole,
  isAdmin = false,
  subActive = false,
  dashboardBadges = null,
  onOpenHelpListings,
  onStop,
  onSend,
  onActivateInfoMode,
  onActivateDeepResearchMode,
  onActivateHelpRequestMode,
  onActivateHelpOfferMode,
  placeholderText,
  forcePlaceholderVisible = false,
  hideComposerTools,
  activeModeLabel,
  roomModeLabel,
  activeModeKey,
  documentFlowActive,
  suppressCareerCvPreview,
  onPickDocumentFile,
  voiceEnabled,
  recording,
  recordingPulse,
  handleMic,
  composerDraftApiRef,
  onDraftStateChange,
  onComposerLayoutChange,
  sendToAssistant,
  setSendToAssistant,
  aiNote,
  recordingError,
  closeSourcesPanel,
  analysisPanelWidth
}) {
  const showChatFace = !profileOpen;
  const showProfileFace = profileOpen;
  const showVisibleAnalysisPanel = analysis.showAnalysisPanel && !suppressCareerCvPreview;
  const panelSources = Array.isArray(scopedSources) ? scopedSources : null;
  const showWorkspaceFace = workspaceOpen;
  const showChatInterface = !workspaceOpen;

  return <>
    <InviteModal />
    <div>
      <>
        {showChatFace ? <div aria-hidden={profileOpen ? "true" : "false"}>
          <div>
            <div className={chatContainerClassName} style={chatRingStyle} role="region" aria-label={t("chat.page_label")} ref={chatContainerRef} data-chat-container="true">
              {showChatInterface && !profileOpen && isMobile ? (
                <ChatMobileTopNav
                  t={t}
                  locale={locale}
                  isLightTheme={isLightTheme}
                  embedded={embedded}
                  handleBackHome={handleBackHome}
                  mobileRailInteractionLocked={
                    (showVisibleAnalysisPanel &&
                      analysis.analysisPanelMode === "overlay") ||
                    mobileRailInteractionLocked
                  }
                  rightRailActiveKey={workspaceOpen ? "workspace" : rightRailActiveKey}
                  toggleProfile={toggleProfile}
                  openProfileDirect={openProfileDirect}
                  workspaceOpen={workspaceOpen}
                  onWorkspaceToggle={onWorkspaceToggle}
                />
              ) : null}

              {showWorkspaceFace ? (
                <WorkspacePanel
                  t={t}
                  locale={locale}
                  userRole={userRole}
                  userActualRole={userActualRole}
                  isAdmin={isAdmin}
                  subActive={subActive}
                  dashboardBadges={dashboardBadges}
                  onOpenHelpListings={onOpenHelpListings}
                  embeddedPanelNode={workspaceListingsPanelNode}
                  embeddedPanelMeta={workspaceListingsPanelMeta}
                  onEmbeddedPanelBack={onWorkspaceListingsPanelBack}
                  onClose={onWorkspaceClose}
                  visible={workspaceSurfaceReady}
                />
              ) : null}
              {/* Admini S/P/T — vestlusepinnal, kus roll juhib süsteemipromptit,
                  RAG-sihtrühma ja vastuse pikkust (lib/chat/requestBootstrap).
                  Töölaua-näol on oma lüliti (WorkspacePanel), seega ainult
                  vestlusevaates; ruumis roll ei mängi (liikmesuspõhine). */}
              {showChatInterface && isAdmin && !isRoomMode ? <RoleViewSwitcher /> : null}
              {listingsPanelNode}
              {selectedListingContextNode}

              {showChatInterface ? <ChatTopNotices t={t} isRoomMode={isRoomMode} roomTitle={roomTitle} roomOrigin={roomOrigin} hideRoomTitle={hideRoomTitle} isCrisis={isCrisis} crisisText={crisisText} errorBanner={errorBanner} roomBlocked={roomBlocked} roomAuthRequired={roomAuthRequired} /> : null}

              {/* T20 P2: kokkuvõtte kinnitusring — nähtav ainult siis, kui
                  ruumis on aktiivne ring (node ise tagastab muidu null). */}
              {showChatInterface ? roomSummaryApprovalNode : null}

              {showChatInterface ? <ConversationView t={t} chatWindowRef={chatWindowRef} isStreamingAny={isStreamingAny} hiddenCount={hiddenCount} pageSize={pageSize} onRevealOlder={onRevealOlder} canHideOlder={canHideOlder} onHideOlder={onHideOlder} onJumpToBottom={onJumpToBottom} messageItems={messageItems} onWindowDoubleClick={onWindowDoubleClick} focusActive={focusActive} isMobile={isMobile} isLightTheme={isLightTheme} hasConversationSources={hasConversationSources} conversationSourcesCount={conversationSources.length} toggleSourcesPanel={toggleSourcesPanel} showSourcesPanel={showSourcesPanel} sourcesPulse={sourcesPulse} sourcesButtonRef={sourcesButtonRef} /> : null}

              {showChatInterface && showVisibleAnalysisPanel && !analysis.uploadPreview ? <ChatAnalysisPanel {...chatAnalysisPanelProps} /> : null}

              {/* Helikõne riba — composeri juures, kirjutamise/saatmise lähedal (omanik 23.07). */}
              {showChatInterface ? roomCallNode : null}

              {showChatInterface ? <ChatComposer key={roomId ? `room:${roomId}:${isHelpMatchRoom ? "help" : "standard"}` : "chat:default"} t={t} locale={locale} isLightTheme={isLightTheme} hideTools={hideComposerTools} inputGlow placeholderText={placeholderText} forcePlaceholderVisible={forcePlaceholderVisible} acceptAttr={analysis.acceptAttr} ensureAnalysisPanelVisible={analysis.ensureAnalysisPanelVisible} fileInputRef={analysis.fileInputRef} onFileChange={analysis.onFileChange} inputRowRef={inputRowRef} inputBarRef={inputBarRef} inputRef={inputRef} onFocusInput={onFocusComposer} onBlurInput={onBlurInput} isGenerating={isGenerating} isStreamingAny={isStreamingAny} isRoomMode={isRoomMode} roomBlocked={roomBlocked} roomAuthRequired={roomAuthRequired} onStop={onStop} onSend={onSend} onActivateInfoMode={onActivateInfoMode} onActivateDeepResearchMode={onActivateDeepResearchMode} onActivateHelpRequestMode={onActivateHelpRequestMode} onActivateHelpOfferMode={onActivateHelpOfferMode} showDocumentAttachButton={documentFlowActive} onPickDocumentFile={onPickDocumentFile} voiceEnabled={voiceEnabled} recording={recording} recordingPulse={recordingPulse} handleMic={handleMic} draftApiRef={composerDraftApiRef} onDraftStateChange={onDraftStateChange} onLayoutChange={onComposerLayoutChange} inputFocused={inputFocused} isMobile={isMobile} activeModeLabel={activeModeLabel} roomModeLabel={roomModeLabel} activeModeKey={activeModeKey} focusActive={focusActive} allowAssistantForward={allowAssistantForward} isHelpMatchRoom={isHelpMatchRoom} sendToAssistant={sendToAssistant} setSendToAssistant={setSendToAssistant} aiNote={aiNote} /> : null}
              {showChatInterface ? <ChatRecordingNotice recordingError={recordingError} floating /> : null}

              {showChatInterface ? <footer /> : null}
              {showChatInterface ? <ChatSourcesPanel
                open={showSourcesPanel}
                t={t}
                locale={locale}
                conversationSources={panelSources || conversationSources}
                latestAnswerSources={panelSources || latestAnswerSources}
                allConversationSources={panelSources || allConversationSources}
                onClose={closeSourcesPanel}
                returnFocusRef={sourcesButtonRef}
              /> : null}
            </div>
            {showChatInterface && showVisibleAnalysisPanel && analysis.uploadPreview ? <div style={analysisPanelWidth ? {
              width: `${analysisPanelWidth}px`,
              maxWidth: `${analysisPanelWidth}px`
            } : undefined}>
              <ChatAnalysisPanel {...chatAnalysisPanelProps} />
            </div> : null}
          </div>
        </div> : null}
        {showProfileFace ? <div aria-hidden={profileOpen ? "false" : "true"}>
          <ProfiilBody embedded isActive={profileOpen} onBack={closeProfile} />
        </div> : null}
      </>
    </div>
  </>;
}
