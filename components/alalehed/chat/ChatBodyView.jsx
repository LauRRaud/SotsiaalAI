import InviteModal from "@/components/invite/InviteModal";
import ProfiilBody from "@/components/alalehed/ProfiilBody";
import ChatAnalysisPanel from "./ChatAnalysisPanel";
import ChatComposer from "./ChatComposer";
import ConversationView from "./ConversationView";
import ChatSourcesPanel from "./ChatSourcesPanel";
import WorkspacePanel from "@/components/chat/WorkspacePanel";
import RoleViewSwitcher from "@/components/workspace/RoleViewSwitcher";
import { ChatRecordingNotice, ChatTopNotices } from "./view/ChatNotices";
import VoiceAvatarBackdrop from "./VoiceAvatarBackdrop";

export default function ChatBodyView({
  embedded: _embedded,
  t,
  locale,
  profileOpen,
  closeProfile,
  workspaceOpen,
  workspaceSurfaceReady,
  /* Alljärgnevad `_`-propid teenindasid mobiilset ülariba, mida enam ei
     renderdata (vt kommentaari chat-container'i sees). ChatBody annab neid
     edasi, seega leping jääb kirja, aga see vaade ei tarbi neid. */
  onWorkspaceToggle: _onWorkspaceToggle,
  onWorkspaceClose,
  isEntering: _isEntering,
  focusActive,
  chatContainerRef,
  chatContainerClassName,
  chatRingStyle,
  handleBackHome: _handleBackHome,
  mobileRailVisible: _mobileRailVisible,
  mobileRailInteractionLocked: _mobileRailInteractionLocked,
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
  rightRailActiveKey: _rightRailActiveKey,
  toggleProfile: _toggleProfile,
  openProfileDirect: _openProfileDirect,
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
  voiceModeNode,
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
  onAuthRequired,
  onOpenVoiceMode,
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
  cancelRecording,
  composerDraftApiRef,
  onDraftStateChange,
  onComposerLayoutChange,
  sendToAssistant,
  setSendToAssistant,
  aiNote,
  recordingError,
  voiceNotice,
  closeSourcesPanel,
  analysisPanelWidth
}) {
  const showChatFace = !profileOpen;
  const showProfileFace = profileOpen;
  const showVisibleAnalysisPanel = analysis.showAnalysisPanel && !suppressCareerCvPreview;
  const panelSources = Array.isArray(scopedSources) ? scopedSources : null;
  const showWorkspaceFace = workspaceOpen;
  const showChatInterface = !workspaceOpen;
  // Häälrežiim on omaette pind. Vestlus jääb mällu alles, kuid mullid,
  // komposer ja muud tekstivaate juhtelemendid tulevad tagasi alles lahkudes.
  const showStandardChat = showChatInterface && !voiceModeNode;

  return <>
    <InviteModal />
    <div>
      <>
        {showChatFace ? <div aria-hidden={profileOpen ? "true" : "false"}>
          <div>
            <div className={chatContainerClassName} style={chatRingStyle} role="region" aria-label={t("chat.page_label")} ref={chatContainerRef} data-chat-container="true" data-voice-active={voiceModeNode ? "true" : undefined}>
              {/* MOBIILI ÜLARIBA EI RENDERDATA. Ruumi-paneeli redisain võttis
                  ChatMobileTopNav'ilt aluse ära: karusselli mähis jäi
                  `position: static`-uks (inline left/top/right on inertsed) ja
                  0-kõrguseks, `overflow: hidden` lõikas kõik 5 nuppu ära —
                  mõõdetud 25.07 mobiilivaates: nupud 0×0. Nähtavale jäid AINULT
                  kaks artefakti, mõlemad karussellist välja pääsenud absoluutsed
                  lapsed: hõljuv silt „Profiil" sõnumite peal (omanik 25.07:
                  „mingi profiil sõna on seal, võta ära") ja lõigatud noole-ikoon
                  ülaservas. Navigatsiooni EI kao: paneel annab ise ☰ (vestlused)
                  ja × (sulge). Komponendifail jääb esialgu alles (svaibi-loogika
                  on selle sees), aga on nüüd viiteta — vt SEIS.md. */}

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
              {showStandardChat && isAdmin && !isRoomMode ? <RoleViewSwitcher /> : null}
              {showStandardChat ? listingsPanelNode : null}
              {showStandardChat ? selectedListingContextNode : null}

              {showStandardChat ? <ChatTopNotices t={t} isRoomMode={isRoomMode} roomTitle={roomTitle} roomOrigin={roomOrigin} hideRoomTitle={hideRoomTitle} isCrisis={isCrisis} crisisText={crisisText} errorBanner={errorBanner} roomBlocked={roomBlocked} roomAuthRequired={roomAuthRequired} /> : null}

              {/* T20 P2: kokkuvõtte kinnitusring — nähtav ainult siis, kui
                  ruumis on aktiivne ring (node ise tagastab muidu null). */}
              {showStandardChat ? roomSummaryApprovalNode : null}

              {/* Sama punktikuju tavavestluse taustal (omanik 22.08). Ainult
                  siis, kui häälreziim on kinni — kaks WebGL-konteksti korraga
                  oleks kaks korda joonistamist ilma ühegi kasuta. */}
              {showStandardChat ? <VoiceAvatarBackdrop /> : null}

              {showChatInterface ? voiceModeNode : null}

              {showStandardChat ? <ConversationView t={t} chatWindowRef={chatWindowRef} isStreamingAny={isStreamingAny} hiddenCount={hiddenCount} pageSize={pageSize} onRevealOlder={onRevealOlder} canHideOlder={canHideOlder} onHideOlder={onHideOlder} onJumpToBottom={onJumpToBottom} messageItems={messageItems} onWindowDoubleClick={onWindowDoubleClick} focusActive={focusActive} isMobile={isMobile} isLightTheme={isLightTheme} hasConversationSources={hasConversationSources} conversationSourcesCount={conversationSources.length} toggleSourcesPanel={toggleSourcesPanel} showSourcesPanel={showSourcesPanel} sourcesPulse={sourcesPulse} sourcesButtonRef={sourcesButtonRef} /> : null}

              {showStandardChat && showVisibleAnalysisPanel && !analysis.uploadPreview ? <ChatAnalysisPanel {...chatAnalysisPanelProps} /> : null}

              {showStandardChat ? <ChatComposer key={roomId ? `room:${roomId}:${isHelpMatchRoom ? "help" : "standard"}` : "chat:default"} t={t} locale={locale} isLightTheme={isLightTheme} hideTools={hideComposerTools} inputGlow placeholderText={placeholderText} forcePlaceholderVisible={forcePlaceholderVisible} acceptAttr={analysis.acceptAttr} ensureAnalysisPanelVisible={analysis.ensureAnalysisPanelVisible} fileInputRef={analysis.fileInputRef} onFileChange={analysis.onFileChange} inputRowRef={inputRowRef} inputBarRef={inputBarRef} inputRef={inputRef} onFocusInput={onFocusComposer} onBlurInput={onBlurInput} isGenerating={isGenerating} isStreamingAny={isStreamingAny} isRoomMode={isRoomMode} roomBlocked={roomBlocked} roomAuthRequired={roomAuthRequired} onStop={onStop} onSend={onSend} onAuthRequired={onAuthRequired} onOpenVoiceMode={onOpenVoiceMode} onActivateInfoMode={onActivateInfoMode} onActivateDeepResearchMode={onActivateDeepResearchMode} onActivateHelpRequestMode={onActivateHelpRequestMode} onActivateHelpOfferMode={onActivateHelpOfferMode} showDocumentAttachButton={documentFlowActive} onPickDocumentFile={onPickDocumentFile} voiceEnabled={voiceEnabled} recording={recording} recordingPulse={recordingPulse} handleMic={handleMic} cancelRecording={cancelRecording} draftApiRef={composerDraftApiRef} onDraftStateChange={onDraftStateChange} onLayoutChange={onComposerLayoutChange} inputFocused={inputFocused} isMobile={isMobile} activeModeLabel={activeModeLabel} roomModeLabel={roomModeLabel} activeModeKey={activeModeKey} focusActive={focusActive} allowAssistantForward={allowAssistantForward} isHelpMatchRoom={isHelpMatchRoom} sendToAssistant={sendToAssistant} setSendToAssistant={setSendToAssistant} aiNote={aiNote} callControlsNode={roomCallNode} /> : null}
              {showStandardChat ? <ChatRecordingNotice recordingError={recordingError} voiceNotice={voiceNotice} floating /> : null}

              {showStandardChat ? <footer /> : null}
              {showStandardChat ? <ChatSourcesPanel
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
