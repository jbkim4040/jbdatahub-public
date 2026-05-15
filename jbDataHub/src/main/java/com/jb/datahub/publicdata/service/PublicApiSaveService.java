package com.jb.datahub.publicdata.service;

import com.jb.datahub.publicdata.dto.PublicApiItemDto;
import com.jb.datahub.publicdata.entity.PublicApiList;
import com.jb.datahub.publicdata.entity.PublicApiOperation;
import com.jb.datahub.publicdata.repository.PublicApiListRepository;
import com.jb.datahub.publicdata.repository.PublicApiOperationRepository;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Slf4j
@Service
@RequiredArgsConstructor
public class PublicApiSaveService {

    private final PublicApiListRepository publicApiListRepository;
    private final PublicApiOperationRepository publicApiOperationRepository;

    @Transactional
    public int saveAll(List<PublicApiItemDto> items) {
        if (items == null || items.isEmpty()) return 0;
        long start = System.currentTimeMillis();

        // 1. 이 페이지의 모든 listId를 한 번에 조회
        List<String> listIds = items.stream()
                .map(PublicApiItemDto::getListId)
                .filter(Objects::nonNull)
                .distinct()
                .collect(Collectors.toList());

        Map<String, PublicApiList> existingLists = publicApiListRepository
                .findAllById(listIds).stream()
                .collect(Collectors.toMap(PublicApiList::getListId, Function.identity()));

        // 2. List 엔티티 생성/업데이트 후 일괄 저장 (flush로 FK 보장)
        // LinkedHashMap: 동일 listId가 여러 번 나와도 마지막 값으로 덮어씀 (dedup)
        Map<String, PublicApiList> listsToSaveMap = new LinkedHashMap<>();
        for (PublicApiItemDto dto : items) {
            if (dto.getListId() == null) continue;
            PublicApiList apiList = existingLists.getOrDefault(dto.getListId(),
                    PublicApiList.builder().listId(dto.getListId()).build());
            applyListFields(dto, apiList);
            listsToSaveMap.put(dto.getListId(), apiList);
        }
        List<PublicApiList> listsToSave = new ArrayList<>(listsToSaveMap.values());
        publicApiListRepository.saveAll(listsToSave);
        publicApiListRepository.flush();

        // 3. 이 페이지의 모든 operationSeq를 한 번에 조회
        Map<String, PublicApiList> savedListMap = listsToSaveMap;

        List<Long> opSeqs = items.stream()
                .filter(dto -> dto.getOperationSeq() != null && !dto.getOperationSeq().isBlank())
                .map(dto -> {
                    try { return Long.parseLong(dto.getOperationSeq()); }
                    catch (NumberFormatException e) { return null; }
                })
                .filter(Objects::nonNull)
                .collect(Collectors.toList());

        Map<Long, PublicApiOperation> existingOps = opSeqs.isEmpty()
                ? Collections.emptyMap()
                : publicApiOperationRepository.findAllById(opSeqs).stream()
                        .collect(Collectors.toMap(PublicApiOperation::getOperationSeq, Function.identity()));

        // 4. Operation 엔티티 생성/업데이트 후 일괄 저장
        List<PublicApiOperation> opsToSave = new ArrayList<>();
        for (PublicApiItemDto dto : items) {
            if (dto.getOperationSeq() == null || dto.getOperationSeq().isBlank()) continue;
            try {
                Long seq = Long.parseLong(dto.getOperationSeq());
                PublicApiList apiList = savedListMap.get(dto.getListId());
                if (apiList == null) continue;
                PublicApiOperation op = existingOps.getOrDefault(seq,
                        PublicApiOperation.builder().operationSeq(seq).build());
                applyOperationFields(dto, op, apiList);
                opsToSave.add(op);
            } catch (Exception e) {
                log.warn("[Save] Operation 저장 실패 - operationSeq={}, error={}", dto.getOperationSeq(), e.getMessage());
            }
        }
        if (!opsToSave.isEmpty()) {
            publicApiOperationRepository.saveAll(opsToSave);
        }

        long elapsed = System.currentTimeMillis() - start;
        log.info("[SavePerf] {} items → list {} (dedup) + op {} saved in {}ms",
                items.size(), listsToSave.size(), opsToSave.size(), elapsed);

        return listsToSave.size();
    }

    private void applyListFields(PublicApiItemDto dto, PublicApiList entity) {
        entity.setListTitle(dto.getListTitle());
        entity.setListType(dto.getListType());
        entity.setApiId(dto.getId());
        entity.setApiType(dto.getApiType());
        entity.setDataFormat(dto.getDataFormat());
        entity.setTitle(dto.getTitle());
        entity.setTitleEn(dto.getTitleEn());
        entity.setOrgCd(dto.getOrgCd());
        entity.setOrgNm(dto.getOrgNm());
        entity.setDeptNm(dto.getDeptNm());
        entity.setCategoryNm(dto.getCategoryNm());
        entity.setNewCategoryCd(dto.getNewCategoryCd());
        entity.setNewCategoryNm(dto.getNewCategoryNm());
        entity.setUpperCategoryCd(dto.getUpperCategoryCd());
        entity.setShareScopeCd(dto.getShareScopeCd());
        entity.setShareScopeNm(dto.getShareScopeNm());
        entity.setGuideUrl(truncate(dto.getGuideUrl(), 500));
        entity.setEndPointUrl(truncate(dto.getEndPointUrl(), 500));
        entity.setSoapUrl(truncate(dto.getSoapUrl(), 500));
        entity.setLinkUrl(truncate(dto.getLinkUrl(), 500));
        entity.setMetaUrl(truncate(dto.getMetaUrl(), 500));
        entity.setDescription(dto.getDesc());
        entity.setIsCharged(dto.getIsCharged());
        entity.setIsCopyrighted(dto.getIsCopyrighted());
        entity.setIsCoreData(dto.getIsCoreData());
        entity.setCoreDataNm(dto.getCoreDataNm());
        entity.setIsStdData(dto.getIsStdData());
        entity.setIsListDeleted(dto.getIsListDeleted());
        entity.setIsDeleted(dto.getIsDeleted());
        entity.setIsConfirmedForDev(dto.getIsConfirmedForDev());
        entity.setIsConfirmedForDevNm(dto.getIsConfirmedForDevNm());
        entity.setIsConfirmedForProd(dto.getIsConfirmedForProd());
        entity.setIsConfirmedForProdNm(dto.getIsConfirmedForProdNm());
        entity.setOwnershipGrounds(dto.getOwnershipGrounds());
        entity.setIsThirdPartyCopyrighted(dto.getIsThirdPartyCopyrighted());
        entity.setUsePrmisnEnnc(dto.getUsePrmisnEnnc());
        entity.setKeywords(dto.getKeywords());
        entity.setRequestCnt(dto.getRequestCnt());
        entity.setUseScopeResn(dto.getUseScopeResn());
        entity.setCreatedAt(parseDate(dto.getCreatedAt()));
        entity.setUpdatedAt(parseDate(dto.getUpdatedAt()));
    }

    private void applyOperationFields(PublicApiItemDto dto, PublicApiOperation entity, PublicApiList list) {
        entity.setPublicApiList(list);
        entity.setOperationNm(dto.getOperationNm());
        entity.setOperationUrl(truncate(dto.getOperationUrl(), 500));
        entity.setRegisterStatus(dto.getRegisterStatus());
        entity.setRequestParamNm(dto.getRequestParamNm());
        entity.setRequestParamNmEn(dto.getRequestParamNmEn());
        entity.setResponseParamNm(dto.getResponseParamNm());
        entity.setResponseParamNmEn(dto.getResponseParamNmEn());
    }

    private LocalDate parseDate(String dateStr) {
        if (dateStr == null || dateStr.isBlank()) return null;
        try {
            return LocalDate.parse(dateStr.trim(), DateTimeFormatter.ofPattern("yyyy-MM-dd"));
        } catch (DateTimeParseException e) {
            return null;
        }
    }

    private String truncate(String value, int maxLength) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.length() > maxLength ? trimmed.substring(0, maxLength) : trimmed;
    }
}
