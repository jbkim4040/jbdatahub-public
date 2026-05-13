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
import java.util.List;

/**
 * DB 저장만 담당
 * - 외부 API 호출 없음
 * - PublicApiList / PublicApiOperation upsert
 */
@Slf4j
@Service
@RequiredArgsConstructor
public class PublicApiSaveService {

    private final PublicApiListRepository publicApiListRepository;
    private final PublicApiOperationRepository publicApiOperationRepository;

    /**
     * DTO 목록을 Entity로 변환하여 upsert 저장
     *
     * @return 성공적으로 저장된 건수
     */
    @Transactional
    public int saveAll(List<PublicApiItemDto> items) {
        int count = 0;
        for (PublicApiItemDto dto : items) {
            count += saveOne(dto);
        }
        return count;
    }

    private int saveOne(PublicApiItemDto dto) {
        try{
            // 1) PublicApiList upsert
            //    saveAndFlush: Operation이 List를 FK로 참조하기 전에
            //    반드시 DB에 먼저 반영되어야 TransientObjectException 방지
            PublicApiList apiList = publicApiListRepository
                    .findById(dto.getListId())
                    .orElseGet(() -> PublicApiList.builder().listId(dto.getListId()).build());

            applyListFields(dto, apiList);
            apiList = publicApiListRepository.saveAndFlush(apiList);

            // 2) PublicApiOperation upsert
            if (dto.getOperationSeq() != null && !dto.getOperationSeq().isBlank()) {
                Long seq = Long.parseLong(dto.getOperationSeq());

                PublicApiOperation operation = publicApiOperationRepository
                        .findById(seq)
                        .orElseGet(() -> PublicApiOperation.builder().operationSeq(seq).build());

                applyOperationFields(dto, operation, apiList);
                publicApiOperationRepository.save(operation);
            }
        }catch(Exception e) {
            log.warn("[Save] 저장 실패 - listId={}, operationSeq={}, error={}",
                    dto.getListId(), dto.getOperationSeq(), e.getMessage());
        }

        return 1;
    }

    // ──────────────────────────────────────────
    //  필드 매핑
    // ──────────────────────────────────────────

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

    // ──────────────────────────────────────────
    //  유틸
    // ──────────────────────────────────────────

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
