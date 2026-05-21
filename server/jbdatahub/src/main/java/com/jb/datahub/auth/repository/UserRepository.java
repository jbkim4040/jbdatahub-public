package com.jb.datahub.auth.repository;

import com.jb.datahub.auth.entity.User;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;

import java.util.List;
import java.util.Optional;

public interface UserRepository extends JpaRepository<User, Long> {
    Optional<User> findByUsername(String username);
    boolean existsByUsername(String username);

    @Query("SELECT u FROM User u WHERE u.serviceKey IS NOT NULL AND u.serviceKey NOT LIKE 'enc:%'")
    List<User> findUsersWithPlaintextServiceKey();
}
