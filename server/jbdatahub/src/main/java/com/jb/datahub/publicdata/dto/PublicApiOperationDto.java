package com.jb.datahub.publicdata.dto;

import com.jb.datahub.publicdata.entity.PublicApiOperation;
import lombok.Getter;

@Getter
public class PublicApiOperationDto {

    private final Long   operationSeq;
    private final String operationNm;
    private final String operationUrl;
    private final String registerStatus;
    private final String requestParamNm;
    private final String requestParamNmEn;
    private final String requiredParamNmEn;
    private final String exampleParamNmEn;
    private final String responseParamNm;
    private final String responseParamNmEn;
    private final String generatedDdl;

    public PublicApiOperationDto(PublicApiOperation op) {
        this.operationSeq       = op.getOperationSeq();
        this.operationNm        = op.getOperationNm();
        this.operationUrl       = op.getOperationUrl();
        this.registerStatus     = op.getRegisterStatus();
        this.requestParamNm     = op.getRequestParamNm();
        this.requestParamNmEn   = op.getRequestParamNmEn();
        this.requiredParamNmEn  = op.getRequiredParamNmEn();
        this.exampleParamNmEn   = op.getExampleParamNmEn();
        this.responseParamNm    = op.getResponseParamNm();
        this.responseParamNmEn  = op.getResponseParamNmEn();
        this.generatedDdl       = op.getGeneratedDdl();
    }
}
