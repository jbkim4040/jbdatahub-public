package com.jb.datahub.publicdata.repository;

import com.jb.datahub.publicdata.entity.PublicApiOperation;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;

public interface PublicApiOperationRepository extends JpaRepository<PublicApiOperation, Long> {

    List<PublicApiOperation> findByPublicApiList_ListId(String listId);
}
