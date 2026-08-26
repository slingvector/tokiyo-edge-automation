package com.tokiyo.core.shizuku;

interface IAgentUserService {
    int getUid();
    String executeShellCommand(String command);
    void destroy();
    String dumpWindowHierarchy();
    boolean injectTouch(int x, int y);
    boolean injectOrganicTap(int x, int y);
    boolean injectOrganicSwipe(int startX, int startY, int endX, int endY, int durationMs);
    boolean injectOrganicText(String text);
    boolean waitForScrollIdle(long timeoutMs);
}
