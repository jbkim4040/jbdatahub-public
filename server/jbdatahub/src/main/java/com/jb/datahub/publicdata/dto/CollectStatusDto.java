package com.jb.datahub.publicdata.dto;

import com.fasterxml.jackson.annotation.JsonInclude;
import com.jb.datahub.publicdata.service.CollectionStateService.StatusSnapshot;
import com.jb.datahub.publicdata.service.CollectionStateService.TypeHistory;
import lombok.Getter;

import java.time.LocalDateTime;
import java.util.HashMap;
import java.util.Map;

@Getter
@JsonInclude(JsonInclude.Include.NON_NULL)
public class CollectStatusDto {

    private final String        status;
    private final String        sourceType;
    private final int           currentPage;
    private final int           totalCount;
    private final int           savedCount;
    private final Integer       progressPct;
    private final Long          elapsedSeconds;
    private final Long          etaSeconds;
    private final LocalDateTime startedAt;
    private final Map<String, TypeHistoryDto> history;

    public CollectStatusDto(StatusSnapshot snap) {
        this.status         = snap.status();
        this.sourceType     = snap.sourceType();
        this.currentPage    = snap.currentPage();
        this.totalCount     = snap.totalCount();
        this.savedCount     = snap.savedCount();
        this.startedAt      = snap.startedAt();
        this.elapsedSeconds = snap.elapsedSeconds() > 0 ? snap.elapsedSeconds() : null;
        this.etaSeconds     = snap.etaSeconds();
        this.progressPct    = ("RUNNING".equals(snap.status()) && snap.totalCount() > 0)
                ? (int) ((long) snap.savedCount() * 100 / snap.totalCount())
                : null;

        Map<String, TypeHistoryDto> hist = new HashMap<>();
        snap.history().forEach((k, v) -> hist.put(k, new TypeHistoryDto(v)));
        this.history = hist;
    }

    @Getter
    public static class TypeHistoryDto {
        private final LocalDateTime lastCompletedAt;
        private final int lastSavedCount;
        private final int lastTotalCount;

        public TypeHistoryDto(TypeHistory h) {
            this.lastCompletedAt = h.lastCompletedAt();
            this.lastSavedCount  = h.lastSavedCount();
            this.lastTotalCount  = h.lastTotalCount();
        }
    }
}
