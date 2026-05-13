package com.jb.datahub.publicdata.repository;

import com.jb.datahub.publicdata.entity.PublicApiList;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PublicApiListRepository extends JpaRepository<PublicApiList, String> {
}
