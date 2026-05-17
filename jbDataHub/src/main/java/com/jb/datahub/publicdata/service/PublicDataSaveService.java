package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.PublicDataItemDto;
import com.jb.datahub.publicdata.entity.PublicDataItem;
import com.jb.datahub.publicdata.repository.PublicDataItemRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.List;

/**
 * dataset / file-data-list / standard-data-list DB 저장 담당
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublicDataSaveService {

    private final PublicDataItemRepository repository;

    @Transactional
    public int saveAll(List<PublicDataItemDto> items, String sourceType) {
        int count = 0;
        for (PublicDataItemDto dto : items) {
            try {
                PublicDataItem entity = repository.findById(dto.getId())
                        .orElseGet(() -> PublicDataItem.builder().id(dto.getId()).build());
                applyFields(dto, entity, sourceType);
                repository.save(entity);
                count++;
            } catch (Exception e) {
                log.warn("[DataSave] 저장 실패 - id={}, error={}", dto.getId(), e.getMessage());
            }
        }
        return count;
    }

    private void applyFields(PublicDataItemDto dto, PublicDataItem entity, String sourceType) {
        entity.setSourceType(sourceType);
        entity.setListId(dto.getListId());
        entity.setListTitle(dto.getListTitle());
        entity.setListType(dto.getListType());
        entity.setTitle(dto.getTitle());
        entity.setOrgCd(dto.getOrgCd());
        entity.setOrgNm(dto.getOrgNm());
        entity.setDeptNm(dto.getDeptNm());
        entity.setDescription(dto.getDesc());
        entity.setKeywords(truncate(dto.getKeywords(), 500));
        entity.setNewCategoryCd(dto.getNewCategoryCd());
        entity.setNewCategoryNm(dto.getNewCategoryNm());
        entity.setCategoryNm(dto.getCategoryNm());
        entity.setCreatedAt(parseDate(dto.getCreatedAt()));
        entity.setUpdatedAt(parseDate(dto.getUpdatedAt()));
        entity.setDownloadCnt(dto.getDownloadCnt());
        entity.setViewCnt(dto.getViewCnt());
        entity.setReqCnt(dto.getReqCnt());
        entity.setRegisterStatus(dto.getRegisterStatus());
        entity.setIsDeleted(dto.getIsDeleted());
        entity.setExt(dto.getExt());
        entity.setDataType(dto.getDataType());
        entity.setMetaUrl(sanitizeUrl(dto.getMetaUrl(), 500));
        entity.setPageUrl(sanitizeUrl(dto.getPageUrl(), 500));
        entity.setIsCharged(dto.getIsCharged());
        entity.setIsCoreData(dto.getIsCoreData());
        entity.setIsStdData(dto.getIsStdData());
        entity.setOwnershipGrounds(dto.getOwnershipGrounds());
        entity.setProvidingScope(dto.getProvidingScope());
        entity.setShareScopeNm(dto.getShareScopeNm());
        entity.setUpdateCycle(dto.getUpdateCycle());
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            return LocalDate.parse(dateStr.trim().substring(0, 10), DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        } catch (DateTimeParseException | StringIndexOutOfBoundsException e) {
            return null;
        }
    }

    private String sanitizeUrl(String value, int maxLength) {
        if (value == null) return null;
        String trimmed = value.trim();
        String lower = trimmed.toLowerCase();
        if (!lower.startsWith("http://") && !lower.startsWith("https://")) return null;
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }
}
