package com.jb.datahub.publicdata.repository;

import com.jb.datahub.publicdata.entity.PublicDataItem;
import org.springframework.data.jpa.repository.JpaRepository;

public interface PublicDataItemRepository extends JpaRepository<PublicDataItem, String> {
}
