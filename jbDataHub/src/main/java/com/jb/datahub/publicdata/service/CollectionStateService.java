package com.jb.datahub.publicdata.service;

import org.springframework.stereotype.Service;

import java.util.concurrent.atomic.AtomicBoolean;

/**
 * 수집 작업의 실행/중지 상태를 관리
 */
@Service
public class CollectionStateService {

    private final AtomicBoolean stopRequested = new AtomicBoolean(false);

    public void requestStop() {
        stopRequested.set(true);
    }

    public void reset() {
        stopRequested.set(false);
    }

    public boolean isStopRequested() {
        return stopRequested.get();
    }
}
